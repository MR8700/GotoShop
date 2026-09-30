import os
import re
import base64
import uuid
import secrets
from datetime import datetime
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from app.models.customer import Customer
from app.models.commerce import OrderIntent, SaleConfirmation
from app.models.store import Store
from app.schemas.customer import (
    CustomerQuickRegisterRequest,
    CustomerQuickLoginRequest,
    CustomerProfileUpdateRequest,
    CustomerOrderItem,
    CustomerStatsResponse,
    MerchantClientItem,
    MerchantClientDetail,
)
from app.config import settings
from app.core.security import hash_session_token, lookup_hash
from app.core.clock import utcnow
from app.core import customer_session

def normalize_phone(phone: str) -> str:
    """Removes extra characters for reliable matching while keeping leading digits/plus."""
    if not phone:
        return ""
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    return cleaned

def _spot_snap(o):
    import json
    try:
        return json.loads(o.delivery.spot_snapshot) if o.delivery and o.delivery.spot_snapshot else {}
    except (TypeError, ValueError):
        return {}


class CustomerService:
    @staticmethod
    def _otp_key(store_id: str) -> str:
        # Indépendante de la boutique : la demande de code et la connexion peuvent résoudre des boutiques différentes.
        return "login"

    @classmethod
    def request_login_otp(cls, db: Session, phone: str, store_id: Optional[str] = None) -> dict:
        from app.services.otp_service import OtpService
        norm = normalize_phone(phone)
        if not norm:
            raise ValueError("Numéro de téléphone requis.")
        sid = cls.get_or_default_store_id(db, store_id)
        ok, msg, payload = OtpService.request_otp(norm, cls._otp_key(sid), 0)
        if not ok:
            raise ValueError(msg)
        payload["message"] = msg
        return payload

    @classmethod
    def _check_login_otp(cls, phone: str, store_id: str, code: Optional[str]) -> None:
        """Exige un OTP valide si REQUIRE_LOGIN_OTP est activé (sinon comportement historique)."""
        if not settings.REQUIRE_LOGIN_OTP:
            return
        from app.services.otp_service import OtpService
        if not code:
            raise ValueError("Code de vérification requis. Demandez-en un via /customer/login/otp/request.")
        ok, msg = OtpService.verify_otp(normalize_phone(phone), cls._otp_key(store_id), code)
        if not ok:
            raise ValueError(msg)

    @classmethod
    def get_or_default_store_id(cls, db: Session, store_id: Optional[str] = None) -> str:
        if store_id:
            return store_id
        primary_store = db.query(Store).first()
        return primary_store.id if primary_store else "default-store"

    @classmethod
    def quick_register(cls, db: Session, req: CustomerQuickRegisterRequest, _otp_checked: bool = False) -> Tuple[Customer, str]:
        store_id = cls.get_or_default_store_id(db, req.store_id)
        norm_phone = normalize_phone(req.phone)
        if not norm_phone:
            raise ValueError("Un numéro de téléphone valide est obligatoire.")
        if not req.name or len(req.name.strip()) < 2:
            raise ValueError("Le nom doit comporter au moins 2 caractères.")

        if not _otp_checked:
            cls._check_login_otp(norm_phone, store_id, getattr(req, "otp_code", None))

        # Find existing customer by phone or create new
        customer = db.query(Customer).filter(
            Customer.store_id == store_id,
            (Customer.phone == req.phone) | (Customer.phone == norm_phone)
        ).first()

        token = secrets.token_urlsafe(32)

        if not customer:
            customer = Customer(
                store_id=store_id,
                name=req.name.strip(),
                phone=norm_phone,
                city=req.city or "Abidjan",
            )
            db.add(customer)
            db.flush()
            cls.set_session(customer, token)
        else:
            # Update name/city and session
            customer.name = req.name.strip()
            if req.city:
                customer.city = req.city
            cls.set_session(customer, token)

        # Link past guest orders matching phone to this customer
        past_intents = db.query(OrderIntent).filter(
            (OrderIntent.customer_id == None) &
            (OrderIntent.store_id == store_id) &
            ((OrderIntent.customer_phone == req.phone) | (OrderIntent.customer_phone == norm_phone))
        ).all()
        for intent in past_intents:
            intent.customer_id = customer.id

        db.commit()
        db.refresh(customer)
        return customer, token

    @classmethod
    def quick_login(cls, db: Session, req: CustomerQuickLoginRequest) -> Tuple[Customer, str]:
        norm_phone = normalize_phone(req.phone)
        if not norm_phone:
            raise ValueError("Numéro de téléphone requis.")

        login_store_id = cls.get_or_default_store_id(db, getattr(req, "store_id", None))
        q_login = db.query(Customer).filter((Customer.phone == req.phone) | (Customer.phone == norm_phone))
        if getattr(req, "store_id", None):
            q_login = q_login.filter(Customer.store_id == login_store_id)  # sans store_id : ancien comportement (compat.)
        customer = q_login.first()
        cls._check_login_otp(norm_phone, customer.store_id if customer else login_store_id, getattr(req, "otp_code", None))

        if not customer:
            # Auto-register if not yet existing for ultra-fast friction-free entry
            name_guess = f"Client {norm_phone[-4:]}"
            return cls.quick_register(db, CustomerQuickRegisterRequest(name=name_guess, phone=norm_phone, store_id=login_store_id), _otp_checked=True)

        token = secrets.token_urlsafe(32)
        cls.set_session(customer, token)
        db.commit()
        db.refresh(customer)
        return customer, token

    # ------------------------------------------------------------------ session (jeton haché + expiration + cookie)
    @classmethod
    def set_session(cls, customer: Customer, raw_token: str) -> None:
        """Stocke l'empreinte + l'expiration, et demande au middleware de poser le cookie HttpOnly."""
        customer.session_token = hash_session_token(raw_token)
        customer.session_expires_at = customer_session.session_expiry()
        customer_session.queue_cookie(raw_token)

    @classmethod
    def clear_session(cls, customer: Customer) -> None:
        customer.session_token = None
        customer.session_expires_at = None
        customer_session.queue_clear_cookie()

    @staticmethod
    def effective_token(explicit: Optional[str]) -> Optional[str]:
        """Jeton présenté : explicite (en-tête / corps) sinon cookie HttpOnly de la requête."""
        if explicit == customer_session.COOKIE_MARKER:
            explicit = None
        return explicit or customer_session.cookie_token()

    @staticmethod
    def is_guest_token(token: Optional[str]) -> bool:
        return bool(token) and (str(token).startswith("guest_") or str(token).startswith("token_local_"))

    @staticmethod
    def expose(token: Optional[str]) -> Optional[str]:
        """Jeton à renvoyer au JavaScript : jamais un jeton de session (sauf CUSTOMER_TOKEN_IN_BODY=true).
        Les jetons invités, propres à une commande, restent renvoyés."""
        if not token:
            return None
        return token if (CustomerService.is_guest_token(token) or settings.CUSTOMER_TOKEN_IN_BODY) else None

    @classmethod
    def token_matches(cls, customer: Optional[Customer], token: Optional[str]) -> bool:
        token = cls.effective_token(token)
        if not customer or not token or not customer.session_token:
            return False
        if customer.session_expires_at and customer.session_expires_at < utcnow():
            return False
        return secrets.compare_digest(customer.session_token, lookup_hash(token))

    @classmethod
    def get_by_token(cls, db: Session, token: Optional[str], store_id: Optional[str] = None) -> Optional[Customer]:
        token = cls.effective_token(token)
        if not token:
            return None
        q = db.query(Customer).filter(Customer.session_token == lookup_hash(token))
        if store_id:
            q = q.filter(Customer.store_id == store_id)
        customer = q.first()
        if customer and customer.session_expires_at and customer.session_expires_at < utcnow():
            return None  # session expirée
        return customer

    @classmethod
    def update_profile(cls, db: Session, customer: Customer, req: CustomerProfileUpdateRequest) -> Customer:
        if req.name and len(req.name.strip()) >= 2:
            customer.name = req.name.strip()
        if req.phone:
            new_phone = normalize_phone(req.phone)
            clash = db.query(Customer.id).filter(
                Customer.store_id == customer.store_id, Customer.phone == new_phone, Customer.id != customer.id
            ).first()
            if clash:
                raise ValueError("Ce numéro est déjà utilisé par un autre compte de cette boutique.")
            customer.phone = new_phone
        if req.email is not None:
            customer.email = req.email.strip() if req.email else None
        if req.city is not None:
            customer.city = req.city
        if req.delivery_address is not None:
            customer.delivery_address = req.delivery_address
        if req.gps_coordinates is not None:
            customer.gps_coordinates = req.gps_coordinates
        if req.gps_location_url is not None:
            customer.gps_location_url = req.gps_location_url
        if req.preferred_channel is not None:
            customer.preferred_channel = req.preferred_channel
        if req.notes is not None:
            customer.notes = req.notes

        # Handle customer avatar upload
        if req.avatar_data and req.avatar_data.startswith("data:image"):
            try:
                header, encoded = req.avatar_data.split(",", 1)
                img_data = base64.b64decode(encoded)
                ext = "png"
                if "jpeg" in header or "jpg" in header:
                    ext = "jpg"
                cust_dir = settings.MEDIA_DIR / "customers"
                os.makedirs(cust_dir, exist_ok=True)
                file_name = f"avatar_{uuid.uuid4().hex[:8]}.{ext}"
                file_path = cust_dir / file_name
                with open(file_path, "wb") as f:
                    f.write(img_data)
                customer.avatar_url = f"/media/customers/{file_name}"
            except Exception as e:
                print("Failed to save customer avatar:", e)

        db.commit()
        db.refresh(customer)
        return customer

    @classmethod
    def get_customer_orders(cls, db: Session, customer: Customer) -> List[CustomerOrderItem]:
        from app.models.order import Order
        results = []
        seen_refs = set()

        # 1. Fetch full Conversational Orders
        real_orders = db.query(Order).filter(
            ((Order.customer_id == customer.id) |
             (Order.customer_phone == customer.phone) |
             (Order.customer_id == customer.id)),
            (Order.is_client_hidden.is_(False) | Order.is_client_hidden.is_(None))
        ).order_by(Order.created_at.desc()).all()

        for o in real_orders:
            seen_refs.add(o.order_number)
            conv_id = o.conversations[0].id if o.conversations else None
            items_list = [
                {
                    "id": it.id,
                    "product_id": it.product_id,
                    "product_name": it.product_name,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price,
                    "total_price": it.total_price,
                    "unit_label": it.unit_label,
                    "customization_text": it.customization_text,
                }
                for it in (o.items or [])
            ]
            first_item = o.items[0] if o.items else None
            prod_name = ", ".join([f"{it.product_name} ({it.quantity})" for it in o.items]) if o.items else "Commande GotoShop"
            prod_img = first_item.product.primary_image_url if first_item and getattr(first_item, "product", None) else None
            store_slug = o.store.slug if o.store else "shop"

            results.append(CustomerOrderItem(
                id=o.id,
                reference_code=o.order_number,
                product_name=prod_name,
                product_image_url=prod_img,
                quantity=int(sum([it.quantity for it in o.items])) if o.items else 1,
                selected_color=first_item.variant_name if first_item else None,
                delivery_city=o.delivery.delivery_city if o.delivery else None,
                fulfillment_type=(o.delivery.fulfillment_type if o.delivery else None) or "HOME",
                spot_name=(_spot_snap(o).get("name") if o.delivery else None),
                spot_hours=(_spot_snap(o).get("hours") if o.delivery else None),
                total_amount=o.total_amount,
                currency=o.currency or "FCFA",
                status=o.status,
                client_status="CANCELLED" if o.status == "CANCELLED" else "PENDING",
                client_feedback=o.rejection_reason,
                client_satisfaction_rating=5 if o.status == "COMPLETED" else None,
                client_action_at=o.updated_at,
                coherence_status="HARMONIZED_PENDING",
                coherence_notes=None,
                is_sold=o.status in ["DELIVERED", "COMPLETED"],
                channel_type="IN_APP_CHAT",
                redirect_url=f"/store/{store_slug}?tab=chat&conv={conv_id}" if conv_id else f"/store/{store_slug}?tab=commandes",
                customer_location_url=o.delivery.maps_url if o.delivery and hasattr(o.delivery, "maps_url") else (f"https://maps.google.com/?q={o.delivery.latitude},{o.delivery.longitude}" if o.delivery and o.delivery.latitude else None),
                customer_coordinates=f"{o.delivery.latitude}, {o.delivery.longitude}" if o.delivery and o.delivery.latitude else None,
                items=items_list,
                conversation_id=conv_id,
                is_client_archived=bool(getattr(o, "is_client_archived", False)),
                is_client_hidden=bool(getattr(o, "is_client_hidden", False)),
                created_at=o.created_at,
            ))

        # 2. Legacy OrderIntents
        intents = db.query(OrderIntent).filter(
            ((OrderIntent.customer_id == customer.id) |
             (OrderIntent.customer_phone == customer.phone)),
            (OrderIntent.is_client_hidden.is_(False) | OrderIntent.is_client_hidden.is_(None))
        ).order_by(OrderIntent.created_at.desc()).all()

        for i in intents:
            if i.reference_code in seen_refs:
                continue
            seen_refs.add(i.reference_code)
            prod_name = i.product.name if i.product else "Produit GotoShop"
            prod_img = i.product.primary_image_url if i.product else None
            is_sold = i.sale_confirmation.is_sold if i.sale_confirmation else None
            store_slug = i.store.slug if i.store else "shop"

            results.append(CustomerOrderItem(
                id=i.id,
                reference_code=i.reference_code,
                product_name=prod_name,
                product_image_url=prod_img,
                quantity=int(i.quantity) if i.quantity else 1,
                selected_color=i.selected_color,
                delivery_city=i.delivery_city,
                total_amount=i.total_amount,
                currency=i.currency or "FCFA",
                status=i.status,
                client_status=i.client_status or "PENDING",
                client_feedback=i.client_feedback,
                client_satisfaction_rating=i.client_satisfaction_rating,
                client_action_at=i.client_action_at,
                coherence_status=i.coherence_status or "HARMONIZED_PENDING",
                coherence_notes=i.coherence_notes,
                is_sold=is_sold,
                channel_type=i.channel_type or "IN_APP_CHAT",
                redirect_url=f"/store/{store_slug}?tab=commandes",
                customer_location_url=i.customer_location_url,
                customer_coordinates=i.customer_coordinates,
                items=None,
                conversation_id=None,
                is_client_archived=bool(getattr(i, "is_client_archived", False)),
                is_client_hidden=bool(getattr(i, "is_client_hidden", False)),
                created_at=i.created_at,
            ))

        return results

    @classmethod
    def link_guest_orders(cls, db: Session, customer: Customer, order_ids: List[str]) -> int:
        if not order_ids:
            return 0
        updated = db.query(OrderIntent).filter(
            OrderIntent.id.in_(order_ids),
            OrderIntent.customer_id == None
        ).update({"customer_id": customer.id}, synchronize_session=False)
        db.commit()
        return updated

    @classmethod
    def get_customer_stats(cls, db: Session, customer: Customer) -> CustomerStatsResponse:
        orders = cls.get_customer_orders(db, customer)
        total_orders = len(orders)
        confirmed_orders = sum(1 for o in orders if o.is_sold is True and o.client_status != "CANCELLED" and o.coherence_status != "DISCREPANCY_CONFLICT")
        satisfied_orders = sum(1 for o in orders if o.client_status == "SATISFIED")
        cancelled_orders = sum(1 for o in orders if o.client_status == "CANCELLED" or o.status == "CANCELLED")
        total_spent = sum(o.total_amount for o in orders if o.is_sold is True and o.client_status != "CANCELLED" and o.coherence_status != "DISCREPANCY_CONFLICT")

        from app.models.store import LoyaltyTier
        store = db.query(Store).filter(Store.id == customer.store_id).first()
        is_loyalty_active = store.is_loyalty_active if (store and store.is_loyalty_active is not None) else True
        spend_per_point = store.loyalty_spend_per_point if (store and store.loyalty_spend_per_point and store.loyalty_spend_per_point > 0) else 1000
        calculated_points = (total_spent // spend_per_point) if is_loyalty_active else 0
        if is_loyalty_active:
            # Le total dépensé ne suffit plus à lui seul : les points expirés ou rachetés doivent
            # sortir du solde affiché (sinon ils « reviennent » à chaque calcul).
            from app.services.loyalty_service import LoyaltyService
            LoyaltyService.expire_due_points(db, customer.store_id, customer.id)
            # Fidélité v3 : le solde (en dixièmes de point) est la seule source de vérité.
            loyalty_points = (customer.bonus_points or 0) / 10.0
        else:
            loyalty_points = 0

        # Le statut (palier) se base sur les points GAGNÉS depuis toujours : dépenser ses points ne le fait pas baisser.
        from app.services.loyalty_v3 import lifetime_earned_points
        tier_pts = lifetime_earned_points(db, customer.store_id, customer.id) if is_loyalty_active else 0

        tiers = db.query(LoyaltyTier).filter(
            LoyaltyTier.store_id == customer.store_id,
            LoyaltyTier.is_active == True
        ).order_by(LoyaltyTier.min_points.asc()).all()

        current_tier = "Bronze"
        next_tier = None
        progress = 100
        serialized_tiers = []

        if tiers:
            for t in tiers:
                serialized_tiers.append({
                    "id": t.id,
                    "name": t.name,
                    "min_points": t.min_points,
                    "badge_label": t.badge_label,
                    "perk_title": t.perk_title,
                    "perk_description": t.perk_description,
                    "discount_percent": t.discount_percent,
                    "is_active": t.is_active,
                    "display_order": t.display_order,
                })

            eligible_tiers = [t for t in tiers if tier_pts >= t.min_points]
            if eligible_tiers:
                current_tier = eligible_tiers[-1].name
            else:
                current_tier = tiers[0].name

            higher_tiers = [t for t in tiers if t.min_points > tier_pts]
            if higher_tiers:
                next_t = higher_tiers[0]
                next_tier = next_t.name
                prev_points = eligible_tiers[-1].min_points if eligible_tiers else 0
                points_span = next_t.min_points - prev_points
                points_earned = tier_pts - prev_points
                progress = min(100, max(0, int((points_earned / points_span) * 100))) if points_span > 0 else 0
            else:
                next_tier = None
                progress = 100
        else:
            if tier_pts >= 30:
                current_tier = "Gold VIP"
                next_tier = None
                progress = 100
            elif tier_pts >= 10:
                current_tier = "Silver"
                next_tier = "Gold VIP"
                progress = min(100, int((tier_pts - 10) / 20 * 100))
            else:
                current_tier = "Bronze"
                next_tier = "Silver"
                progress = min(100, int(tier_pts / 10 * 100))

        # Estimate savings as ~10% of total orders amount or at least 5000 FCFA on flash
        savings = int(total_spent * 0.12) if total_spent > 0 else 0

        # Determine favorite channel
        channels_count = {}
        for o in orders:
            channels_count[o.channel_type] = channels_count.get(o.channel_type, 0) + 1
        favorite_ch = max(channels_count, key=channels_count.get) if channels_count else "WHATSAPP"

        return CustomerStatsResponse(
            total_orders=total_orders,
            confirmed_orders=confirmed_orders,
            satisfied_orders=satisfied_orders,
            cancelled_orders=cancelled_orders,
            total_spent=total_spent,
            loyalty_points=loyalty_points,
            loyalty_tier=current_tier,
            next_tier=next_tier,
            next_tier_progress=progress,
            savings_amount=savings,
            favorite_channel=favorite_ch,
            member_since=customer.created_at,
            currency="FCFA",
            is_loyalty_active=is_loyalty_active,
            loyalty_spend_per_point=spend_per_point,
            all_tiers=serialized_tiers
        )

    @classmethod
    def get_merchant_clients(cls, db: Session, store_id: str, search: Optional[str] = None) -> List[MerchantClientItem]:
        query = db.query(Customer).filter(Customer.store_id == store_id)
        if search and search.strip():
            t = f"%{search.strip()}%"
            query = query.filter(
                (Customer.name.ilike(t)) | (Customer.phone.ilike(t)) | (Customer.city.ilike(t)) | (Customer.email.ilike(t))
            )
        customers = query.order_by(Customer.created_at.desc()).all()

        results = []
        for c in customers:
            orders = db.query(OrderIntent).filter(
                (OrderIntent.customer_id == c.id) | (OrderIntent.customer_phone == c.phone)
            ).all()

            total_orders = len(orders)
            confirmed = [o for o in orders if o.status == "SOLD"]
            cancelled = [o for o in orders if o.status == "CANCELLED" or o.client_status == "CANCELLED"]
            total_spent = sum(o.total_amount for o in confirmed)

            # Loyalty points
            from app.services.loyalty_v3 import lifetime_earned_points, tier_for
            bonus_pts = int(getattr(c, "bonus_points", 0) or 0) / 10.0
            loyalty_points = bonus_pts
            _lt = lifetime_earned_points(db, c.store_id, c.id)
            tier_label = {"Gold VIP": "Membre Or VIP", "Silver": "Membre Argent"}.get(tier_for(_lt), "Membre Bronze")

            # Satisfaction rating avg
            rated = [o.client_satisfaction_rating for o in orders if o.client_satisfaction_rating]
            avg_rating = round(sum(rated) / len(rated), 1) if rated else None

            last_interaction = max((o.created_at for o in orders), default=c.created_at)

            results.append(MerchantClientItem(
                id=c.id,
                name=c.name,
                phone=c.phone,
                email=c.email,
                city=c.city or "Abidjan",
                delivery_address=c.delivery_address,
                gps_location_url=c.gps_location_url,
                avatar_url=c.avatar_url,
                is_blocked=bool(getattr(c, "is_blocked", False)),
                moderation_notes=getattr(c, "moderation_notes", None),
                bonus_points=bonus_pts,
                custom_discount_percent=int(getattr(c, "custom_discount_percent", 0) or 0),
                custom_perk_note=getattr(c, "custom_perk_note", None),
                total_orders_count=total_orders,
                confirmed_sales_count=len(confirmed),
                cancelled_count=len(cancelled),
                total_spent=total_spent,
                currency="FCFA",
                loyalty_points=loyalty_points,
                loyalty_tier=tier_label,
                average_satisfaction=avg_rating,
                last_interaction_at=last_interaction,
                created_at=c.created_at,
            ))
        return results

    @classmethod
    def get_merchant_client_detail(cls, db: Session, store_id: str, customer_id: str) -> Optional[MerchantClientDetail]:
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not customer:
            return None

        orders = cls.get_customer_orders(db, customer)
        confirmed_orders = [o for o in orders if o.status == "SOLD"]
        cancelled_orders = [o for o in orders if o.status == "CANCELLED" or o.client_status == "CANCELLED"]
        total_spent = sum(o.total_amount for o in confirmed_orders)

        from app.services.loyalty_v3 import lifetime_earned_points, tier_for
        bonus_pts = int(getattr(customer, "bonus_points", 0) or 0) / 10.0
        loyalty_points = bonus_pts
        _lt = lifetime_earned_points(db, customer.store_id, customer.id)
        tier_label = {"Gold VIP": "Membre Or VIP", "Silver": "Membre Argent"}.get(tier_for(_lt), "Membre Bronze")

        rated = [o.client_satisfaction_rating for o in orders if o.client_satisfaction_rating]
        avg_rating = round(sum(rated) / len(rated), 1) if rated else None

        last_interaction = max((o.created_at for o in orders), default=customer.created_at)

        return MerchantClientDetail(
            id=customer.id,
            name=customer.name,
            phone=customer.phone,
            email=customer.email,
            city=customer.city or "Abidjan",
            delivery_address=customer.delivery_address,
            gps_location_url=customer.gps_location_url,
            avatar_url=customer.avatar_url,
            is_blocked=bool(getattr(customer, "is_blocked", False)),
            moderation_notes=getattr(customer, "moderation_notes", None),
            bonus_points=bonus_pts,
            custom_discount_percent=int(getattr(customer, "custom_discount_percent", 0) or 0),
            custom_perk_note=getattr(customer, "custom_perk_note", None),
            total_orders_count=len(orders),
            confirmed_sales_count=len(confirmed_orders),
            cancelled_count=len(cancelled_orders),
            total_spent=total_spent,
            currency="FCFA",
            loyalty_points=loyalty_points,
            loyalty_tier=tier_label,
            average_satisfaction=avg_rating,
            last_interaction_at=last_interaction,
            created_at=customer.created_at,
            orders=orders,
        )

    @classmethod
    def moderate_client(
        cls, db: Session, store_id: str, customer_id: str, is_blocked: Optional[bool] = None, notes: Optional[str] = None
    ) -> Optional[Customer]:
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not customer:
            return None
        if is_blocked is not None:
            customer.is_blocked = is_blocked
        if notes is not None:
            customer.moderation_notes = notes
        db.commit()
        db.refresh(customer)
        return customer

    @classmethod
    def grant_client_perk(
        cls, db: Session, store_id: str, customer_id: str, bonus_points: float = 0, discount_pct: int = 0, perk_note: Optional[str] = None
    ) -> Optional[Customer]:
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not customer:
            return None
        # Les points passent par le grand livre (LoyaltyService) au lieu de muter bonus_points
        # directement : le geste commercial du marchand apparaît alors dans l'historique du
        # client, au lieu d'un solde qui change sans explication.
        bonus_points = int(round(float(bonus_points or 0) * 10))  # points saisis -> dixièmes (fidélité v3)
        if bonus_points:
            from app.services.loyalty_service import LoyaltyService
            try:
                if bonus_points > 0:
                    LoyaltyService.credit_points(
                        db=db, store_id=store_id, customer_id=customer_id, points=bonus_points, validity_days=0,
                        entry_type="MERCHANT_GRANT",
                        description=perk_note or "Avantage accordé par le commerçant",
                    )
                else:
                    current_bonus = int(getattr(customer, "bonus_points", 0) or 0)
                    to_debit = min(abs(bonus_points), current_bonus)
                    if to_debit > 0:
                        LoyaltyService.debit_points(
                            db=db, store_id=store_id, customer_id=customer_id, points=to_debit,
                            entry_type="MERCHANT_ADJUSTMENT",
                            description=perk_note or "Ajustement du commerçant",
                        )
            except ValueError:
                pass  # solde insuffisant ou autre cas déjà géré côté ledger : on ignore le crédit/débit de points
        if discount_pct is not None and discount_pct >= 0:
            customer.custom_discount_percent = discount_pct
        if perk_note is not None:
            customer.custom_perk_note = perk_note
        db.commit()
        db.refresh(customer)
        return customer
