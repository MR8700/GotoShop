import re
import json
import uuid
import secrets
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.models.order import Order, OrderItem, OrderDelivery
from app.models.payment import Payment, PaymentProof
from app.models.chat import Conversation
from app.models.store import Store, StoreAccessHistory
from app.models.catalog import Product, ProductVariant
from app.models.customer import Customer
from app.models.audit import AuditLog
from app.models.commerce import OrderIntent
from app.services.chat_service import ChatService
from app.services.store_service import StoreService
from app.services.notification_engine import NotificationEngine
from app.realtime.connection_manager import manager
from app.services.delivery_spot_service import spot_to_dict, load_json as _load_json
from app.core.clock import utcnow

_DELIVERY_STATUS_BY_ORDER = {
    "READY_FOR_DELIVERY": "ASSIGNED",
    "OUT_FOR_DELIVERY": "IN_TRANSIT",
    "DELIVERED": "DELIVERED",
    "COMPLETED": "DELIVERED",
    "CANCELLED": "FAILED",
    "REJECTED": "FAILED",
}


def sync_delivery_status(order):
    """Aligne order_deliveries.delivery_status sur le statut de la commande (une seule vérité)."""
    d = getattr(order, "delivery", None)
    target = _DELIVERY_STATUS_BY_ORDER.get(order.status)
    if not d or not target or d.delivery_status == target:
        return
    d.delivery_status = target
    now = utcnow()
    if target == "IN_TRANSIT" and not d.started_at:
        d.started_at = now
    if target == "DELIVERED" and not d.delivered_at:
        d.delivered_at = now


def _valid_share_code(db, store_id, code):
    """Code de publicité accepté seulement s'il appartient à CETTE boutique (jamais d'attribution à une autre boutique)."""
    try:
        from app.services.share_ad_service import ShareAdService
        return ShareAdService.valid_code(db, store_id, code)
    except Exception:
        return None


class OrderService:
    _TERMINAL_CANCELLED = ("CANCELLED", "ANNULEE", "REJECTED")
    _FINAL_STATES = ("CANCELLED", "ANNULEE", "REJECTED", "COMPLETED")

    @staticmethod
    def _release_order_resources(db: Session, order: Order, reason: Optional[str] = None) -> None:
        """Remet en stock, libère le coupon utilisé et annule l'intention liée (une seule fois par commande)."""
        for it in (order.items or []):
            if it.product_id:
                prod = db.query(Product).filter(Product.id == it.product_id).first()
                if prod and prod.stock is not None:
                    prod.stock = round(float(prod.stock) + float(it.quantity), 3)
                    prod.stock_label = f"Stock: {prod.stock} {it.unit_label}".strip()
        try:
            from app.models.loyalty import LoyaltyRewardCoupon
            for c in db.query(LoyaltyRewardCoupon).filter(LoyaltyRewardCoupon.order_id == order.id, LoyaltyRewardCoupon.is_used == True).all():
                c.is_used = False
                c.used_at = None
                c.order_id = None
        except Exception as e_c:
            print("Notice: coupon release skipped:", e_c)
        try:
            from app.services.loyalty_v3 import refund_spent
            refund_spent(db, order)
        except Exception as e_rs:
            print("Notice: loyalty refund_spent skipped:", e_rs)
        from app.models.commerce import OrderIntent
        linked = db.query(OrderIntent).filter(OrderIntent.reference_code == order.order_number).first()
        if linked and linked.status != "CANCELLED":
            linked.status = "CANCELLED"
            linked.client_status = "CANCELLED"
            linked.client_feedback = reason or order.rejection_reason
            linked.client_action_at = utcnow()

    @staticmethod
    def generate_order_number(db: Session, store_slug: Optional[str] = None) -> str:
        prefix = "CMD"
        if store_slug and "kossodo" in store_slug.lower():
            prefix = "KSD"
        elif store_slug and "danfani" in store_slug.lower():
            prefix = "FSD"
        
        # Count existing orders and ensure unique order_number
        count = db.query(Order).count() + 1040
        candidate = f"{prefix}-{count}"
        offset = 0
        while db.query(Order).filter(Order.order_number == candidate).first():
            offset += 1
            candidate = f"{prefix}-{count + offset}"
        return candidate

    @staticmethod
    def _resolve_delivery_fee(db: Session, store_id: str, city_name: Optional[str], client_fee: Any) -> int:
        """Frais de livraison décidés par le serveur.

        - ville de la boutique avec tarif configuré → ce tarif (le client ne peut pas le modifier) ;
        - sinon → valeur du client, bornée à [0, MAX_UNCONFIGURED_DELIVERY_FEE].
        """
        from app.config import settings
        from app.models.store import DeliveryCity

        wanted = (city_name or "").strip().lower()
        if wanted:
            for dc in db.query(DeliveryCity).filter(DeliveryCity.store_id == store_id).all():
                names = {(dc.name or "").strip().lower(), (dc.display_label or "").strip().lower()}
                if wanted in names and dc.delivery_fee is not None:
                    return max(0, int(dc.delivery_fee))
        try:
            fee = int(client_fee or 0)
        except (TypeError, ValueError):
            fee = 0
        return min(max(0, fee), settings.MAX_UNCONFIGURED_DELIVERY_FEE)

    @staticmethod
    def create_order(
        db: Session,
        store_id: str,
        items_data: List[Dict[str, Any]],
        delivery_data: Dict[str, Any],
        customer_name: str,
        customer_phone: Optional[str] = None,
        customer_email: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_token: Optional[str] = None,
        delivery_fee: int = 500,
        notes: Optional[str] = None,
        register_account: bool = False,
        country: Optional[str] = "Burkina Faso",
        city: Optional[str] = "Ouagadougou",
        delivery_neighborhood: Optional[str] = None,
        coupon_code: Optional[str] = None,
        use_tier_discount: bool = True,
        loyalty_item_index: Optional[int] = None,
        loyalty_points: Optional[float] = None,
        share_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            store = StoreService.resolve_store(db, slug=store_id)
            if not store:
                store = StoreService.get_default_store(db)
            if not store:
                raise ValueError(f"Boutique introuvable ({store_id})")

            actual_store_id = store.id

            if not items_data:
                raise ValueError("Veuillez ajouter au moins un produit à votre commande.")

            safe_customer_name = (customer_name or "").strip() or "Client GotoShop"

            # Validate or auto-create customer for seamless checkout onboarding
            actual_customer_id = None
            cust = None
            _tok_ok = lambda t: bool(t) and not str(t).startswith("guest_") and not str(t).startswith("token_local_")
            if customer_id and not str(customer_id).startswith("cust-local-"):
                cust = db.query(Customer).filter(
                    Customer.id == str(customer_id), Customer.store_id == actual_store_id
                ).first()
            if not cust and customer_phone:
                clean_phone = customer_phone.replace(" ", "").replace("-", "")
                cust = db.query(Customer).filter(
                    Customer.store_id == actual_store_id,
                    (Customer.phone == customer_phone) | (Customer.phone == clean_phone)
                ).first()

            # Un numéro de téléphone seul n'est PAS une preuve d'identité : sans jeton de session valide,
            # on ne rattache pas la commande au compte existant et on ne lui fait pas adopter un jeton.
            from app.services.customer_service import CustomerService as _CS
            customer_token = _CS.effective_token(customer_token)
            if cust and not (_tok_ok(customer_token) and _CS.token_matches(cust, customer_token)):
                cust = None
                customer_phone_taken = True
            else:
                customer_phone_taken = False

            existing_client = cust  # compte déjà connu et prouvé (sinon : visiteur pour les remises boutique)
            if cust:
                actual_customer_id = cust.id
                if safe_customer_name and safe_customer_name != "Client GotoShop":
                    cust.name = safe_customer_name
                # customer_token = jeton brut déjà prouvé ci-dessus (l'empreinte seule est en base)
                if country and not cust.country:
                    cust.country = country
                if city and not cust.city:
                    cust.city = city
                if delivery_neighborhood and not cust.delivery_neighborhood:
                    cust.delivery_neighborhood = delivery_neighborhood
            elif customer_phone and not customer_phone_taken and (register_account or safe_customer_name):
                new_session_token = customer_token if (customer_token and not str(customer_token).startswith("guest_") and not str(customer_token).startswith("token_local_")) else secrets.token_hex(24)
                cust = Customer(
                    id=str(uuid.uuid4()),
                    store_id=actual_store_id,
                    name=safe_customer_name,
                    phone=re.sub(r"[^\d+]", "", customer_phone) or customer_phone,
                    email=customer_email,
                    country=country or "Burkina Faso",
                    city=city or "Ouagadougou",
                    delivery_neighborhood=delivery_neighborhood,
                    created_at=utcnow()
                )
                _CS.set_session(cust, new_session_token)
                db.add(cust)
                db.flush()
                actual_customer_id = cust.id
                customer_token = new_session_token
            else:
                # Invité (sans téléphone, ou téléphone déjà lié à un compte non prouvé) : jeton invité propre à la commande
                if not customer_token or customer_phone_taken:
                    customer_token = "guest_" + secrets.token_hex(12)

            order_number = OrderService.generate_order_number(db, store.slug)
            order_id = str(uuid.uuid4())

            # Calculate items subtotal
            subtotal = 0
            order_items = []
            for it in items_data:
                product_id = it.get("product_id")
                variant_id = it.get("variant_id")
                qty = float(it.get("quantity", 1.0))
                if qty != qty or qty in (float("inf"), float("-inf")):
                    raise ValueError("Quantité invalide.")
                if qty <= 0:
                    qty = 1.0

                product = None
                if product_id:
                    product = db.query(Product).filter(Product.id == product_id, Product.store_id == actual_store_id).with_for_update().first()
                    if not product and hasattr(Product, "slug"):
                        product = db.query(Product).filter(Product.slug == product_id, Product.store_id == actual_store_id).first()

                if not product and it.get("product_name"):
                    product = db.query(Product).filter(
                        Product.store_id == actual_store_id,
                        Product.name == it.get("product_name")
                    ).first()

                # Polymorphic unit and pricing model resolution
                unit = it.get("unit") or (getattr(product, "sales_unit", None) or "PIECE")
                unit_label = it.get("unit_label") or (getattr(product, "sales_unit_label", None) or "pièce")
                pricing_model = it.get("pricing_model") or (getattr(product, "pricing_model", None) or "FIXED_PER_UNIT")

                # Validate constraints against product sales configuration only if real product matched
                if product:
                    min_q = getattr(product, "min_quantity", 0.01) or 0.01
                    max_q = getattr(product, "max_quantity", 9999.0) or 9999.0
                    step_q = getattr(product, "quantity_step", 1.0) or 1.0
                    if min_q and qty < min_q:
                        qty = float(min_q)
                    if max_q and qty > max_q:
                        qty = float(max_q)

                product_name = it.get("product_name") or (product.name if product else "Produit")
                # Le prix vient du catalogue : le prix envoyé par le client n'est retenu que pour un article
                # hors catalogue, et jamais négatif.
                if product and getattr(product, "price", None) is not None:
                    raw_price = product.price
                else:
                    raw_price = it.get("unit_price") if it.get("unit_price") is not None else it.get("price")
                    if raw_price is None:
                        raw_price = 0
                    if float(raw_price) < 0:
                        raise ValueError("Prix invalide.")
                unit_price = int(round(float(raw_price or 0)))

                var = None
                variant_name = it.get("variant_name") or it.get("selected_color")
                if variant_id:
                    var_q = db.query(ProductVariant).filter(ProductVariant.id == variant_id)
                    if product:
                        # Le variant doit appartenir au produit commandé (sinon son prix pourrait être détourné)
                        var_q = var_q.filter(ProductVariant.product_id == product.id)
                    var = var_q.first()
                    if var:
                        variant_name = var.name
                        if var.price_override:
                            unit_price = int(round(float(var.price_override)))

                total_price = int(round(unit_price * qty))
                subtotal += total_price

                customization_text = it.get("customization_text")
                customization_options = it.get("customization_options")
                if isinstance(customization_options, (dict, list)):
                    customization_options = json.dumps(customization_options, ensure_ascii=False)

                measurements = it.get("measurements")
                if isinstance(measurements, (dict, list)):
                    measurements = json.dumps(measurements, ensure_ascii=False)

                is_customized = bool(customization_text or customization_options or measurements)

                # Store snapshot of sales configuration
                sales_config_snapshot = json.dumps({
                    "sales_unit": unit,
                    "sales_unit_label": unit_label,
                    "measurement_type": getattr(product, "measurement_type", "COUNT") if product else "COUNT",
                    "pricing_model": pricing_model,
                    "quantity_step": getattr(product, "quantity_step", 1.0) if product else 1.0,
                    "quantity_precision": getattr(product, "quantity_precision", 0) if product else 0,
                    "min_quantity": getattr(product, "min_quantity", 1.0) if product else 1.0,
                    "max_quantity": getattr(product, "max_quantity", 9999.0) if product else 9999.0,
                }, ensure_ascii=False)

                # Atomically decrement stock if tracked (refus si insuffisant, plus d'écrêtage silencieux à 0)
                if product and product.stock is not None:
                    # Décrément atomique : UPDATE ... WHERE stock >= qty (pas de survente en cas de commandes simultanées)
                    from app.models.catalog import Product as _Product
                    updated = db.query(_Product).filter(
                        _Product.id == product.id, _Product.stock >= qty
                    ).update({_Product.stock: _Product.stock - qty}, synchronize_session=False)
                    if not updated:
                        db.refresh(product)
                        raise ValueError(f"Stock insuffisant pour « {product.name} » ({product.stock} disponible).")
                    db.refresh(product)
                    product.stock = max(0.0, round(float(product.stock), 3))
                    product.stock_label = f"Stock: {product.stock} {unit_label}".strip()

                # Store only valid ForeignKeys
                actual_product_id = product.id if product else None
                actual_variant_id = var.id if var else None

                item = OrderItem(
                    id=str(uuid.uuid4()),
                    order_id=order_id,
                    product_id=actual_product_id,
                    variant_id=actual_variant_id,
                    product_name=product_name,
                    variant_name=variant_name,
                    quantity=qty,
                    unit=unit,
                    unit_label=unit_label,
                    unit_price=unit_price,
                    total_price=total_price,
                    pricing_model=pricing_model,
                    measurements=measurements,
                    sales_config_snapshot=sales_config_snapshot,
                    is_customized=is_customized,
                    customization_text=customization_text,
                    customization_options=customization_options
                )
                order_items.append(item)

            # Calculate discount from coupon or loyalty tier
            discount_amount = 0
            applied_coupon_id = None
            if coupon_code:
                from app.services.loyalty_service import LoyaltyService
                coupon_res = LoyaltyService.validate_coupon(db, actual_store_id, coupon_code, subtotal, customer_id=actual_customer_id)
                if not coupon_res.get("valid"):
                    # Avant : le coupon était ignoré en silence et le client payait plus que le prix affiché.
                    raise ValueError(coupon_res.get("message") or "Code promo invalide.")
                discount_amount = coupon_res.get("discount_amount", 0)
                applied_coupon_id = coupon_res.get("coupon_id")
            # Remise boutique (audience : tous / clients / visiteurs / clients choisis) : une seule, la plus forte.
            # Pas de cumul avec un coupon : le meilleur des deux s'applique (le coupon écarté n'est pas consommé).
            shop_discount = None
            try:
                from app.services.discount_service import best_for as _best_shop_discount
                from app.services.discount_service import build_lines as _discount_lines
                _lines = _discount_lines(db, actual_store_id, [
                    {"product_id": oi.product_id, "amount": int(oi.total_price or 0)} for oi in order_items
                ])
                shop_discount = _best_shop_discount(db, actual_store_id, existing_client, subtotal, _lines)
            except Exception as e_sd:
                print("Notice: shop discount skipped:", e_sd)
            if shop_discount:
                if shop_discount["amount"] >= discount_amount:
                    discount_amount = shop_discount["amount"]
                    applied_coupon_id = None
                else:
                    shop_discount = None
            # Fidélité v3 : la remise de palier automatique est remplacée par la dépense de points sur UN produit.
            if loyalty_points and float(loyalty_points) > 0:
                if getattr(store, "is_loyalty_active", True) is False:
                    raise ValueError("Le programme de fidélité est désactivé pour cette boutique.")
                if not actual_customer_id:
                    raise ValueError("Connectez-vous à votre compte client pour utiliser vos points.")
                if coupon_code:
                    raise ValueError("Un coupon et des points ne peuvent pas être cumulés : choisissez l'un des deux.")
                if loyalty_item_index is None or not (0 <= int(loyalty_item_index) < len(order_items)):
                    raise ValueError("Choisissez le produit sur lequel utiliser vos points.")
                from app.services.loyalty_v3 import spend_on_item
                target = order_items[int(loyalty_item_index)]
                discount_amount += spend_on_item(
                    db, store_id=actual_store_id, customer_id=actual_customer_id, order_id=order_id,
                    order_number=order_number, unit_price=int(target.unit_price or 0),
                    product_name=target.product_name, points=float(loyalty_points),
                )

            # Cohérence entre la position GPS du client et la ville de livraison choisie (alerte, non bloquant)
            loc_status, loc_distance = None, None
            if delivery_data.get("fulfillment_type", "HOME") == "HOME" and not delivery_data.get("spot_id"):
                from app.models.store import DeliveryCity
                from app.services.geo_service import check_location
                _cities = db.query(DeliveryCity).filter(DeliveryCity.store_id == actual_store_id).all()
                _res = check_location(_cities, delivery_data.get("delivery_city") or city,
                                      delivery_data.get("latitude"), delivery_data.get("longitude"))
                loc_status, loc_distance = _res["status"], _res["distance_km"]

            # Lieu de retrait / de livraison choisi par le client (défini par le commerçant)
            spot_row = None
            if delivery_data.get("spot_id"):
                from app.models.store import DeliverySpot
                spot_row = db.query(DeliverySpot).filter(
                    DeliverySpot.id == delivery_data["spot_id"],
                    DeliverySpot.store_id == actual_store_id,
                    DeliverySpot.is_active == True,
                ).first()
                if not spot_row:
                    raise ValueError("Ce lieu de retrait ou de livraison n'est plus disponible. Choisissez-en un autre.")
                delivery_data = dict(delivery_data)
                delivery_data["fulfillment_type"] = "PICKUP" if spot_row.kind == "PICKUP" else "MEETING_POINT"
                delivery_data["delivery_city"] = spot_row.city or delivery_data.get("delivery_city")
                delivery_data["delivery_address"] = spot_row.name + (f" — {spot_row.address}" if spot_row.address else "")
                if spot_row.latitude is not None and spot_row.longitude is not None:
                    delivery_data["latitude"], delivery_data["longitude"] = spot_row.latitude, spot_row.longitude
                else:
                    delivery_data["latitude"] = delivery_data["longitude"] = None
            else:
                delivery_data = dict(delivery_data)
                delivery_data["fulfillment_type"] = "HOME"

            if spot_row is not None and spot_row.kind == "PICKUP":
                delivery_fee = 0  # retrait sur place : aucun frais de livraison
            elif spot_row is not None and spot_row.delivery_fee is not None:
                delivery_fee = max(0, int(spot_row.delivery_fee))
            else:
                delivery_fee = OrderService._resolve_delivery_fee(
                    db, actual_store_id, delivery_data.get("delivery_city") or city, delivery_fee
                )
            total_amount = max(0, subtotal - discount_amount) + delivery_fee

            if applied_coupon_id:
                from app.models.loyalty import LoyaltyRewardCoupon
                c_row = db.query(LoyaltyRewardCoupon).filter(LoyaltyRewardCoupon.id == applied_coupon_id).with_for_update().first()
                if not c_row or c_row.is_used:
                    raise ValueError("Ce coupon vient d'être utilisé. Retirez-le et validez à nouveau votre commande.")
                c_row.is_used = True
                c_row.used_at = utcnow()
                c_row.order_id = order_id

            order = Order(
                id=order_id,
                order_number=order_number,
                store_id=actual_store_id,
                customer_id=actual_customer_id,
                customer_token=customer_token if _CS.is_guest_token(customer_token) else None,
                customer_name=safe_customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                status="PENDING_SELLER_ACCEPTANCE",
                payment_status="PAYMENT_PENDING",
                subtotal_amount=subtotal,
                delivery_fee=delivery_fee,
                discount_amount=discount_amount,
                total_amount=total_amount,
                currency=store.currency or "FCFA",
                notes=notes,
                share_code=_valid_share_code(db, actual_store_id, share_code),
                is_client_archived=False,
                is_client_hidden=False,
                created_at=utcnow()
            )
            db.add(order)
            db.flush()

            for itm in order_items:
                db.add(itm)

            # Delivery details
            delivery = OrderDelivery(
                id=str(uuid.uuid4()),
                order_id=order.id,
                delivery_mode=delivery_data.get("delivery_mode", "GPS_AND_DESCRIPTION"),
                delivery_city=delivery_data.get("delivery_city", "Kossodo (Ouagadougou)"),
                delivery_address=delivery_data.get("delivery_address"),
                latitude=delivery_data.get("latitude"),
                longitude=delivery_data.get("longitude"),
                location_accuracy=delivery_data.get("location_accuracy"),
                location_captured_at=utcnow() if delivery_data.get("latitude") else None,
                delivery_notes=delivery_data.get("delivery_notes"),
                fulfillment_type=delivery_data.get("fulfillment_type") or "HOME",
                location_status=loc_status,
                location_distance_km=loc_distance,
                spot_id=spot_row.id if spot_row else None,
                spot_snapshot=json.dumps(spot_to_dict(spot_row), ensure_ascii=False) if spot_row else None,
                delivery_status="PENDING"
            )
            db.add(delivery)

            # Initial pending payment record
            payment = Payment(
                id=str(uuid.uuid4()),
                order_id=order.id,
                store_id=actual_store_id,
                amount=total_amount,
                currency=order.currency,
                payment_method="MOBILE_MONEY_PROOF",
                status="PAYMENT_PENDING"
            )
            db.add(payment)

            # Also create a bridging OrderIntent so existing analytics & metrics reflect this sale
            try:
                intent_product = db.query(Product).filter(Product.id == order_items[0].product_id).first() if order_items and order_items[0].product_id else None
                if not intent_product:
                    intent_product = db.query(Product).filter(Product.store_id == actual_store_id).first() or db.query(Product).first()

                if intent_product:
                    intent = OrderIntent(
                        id=str(uuid.uuid4()),
                        reference_code=order_number,
                        store_id=actual_store_id,
                        product_id=intent_product.id,
                        channel_type="IN_APP_CHAT",
                        customer_name=customer_name,
                        customer_phone=customer_phone,
                        customer_source="CONVERSATIONAL_COMMERCE",
                        customer_location_url=f"https://maps.google.com/?q={delivery.latitude},{delivery.longitude}" if delivery.latitude else None,
                        customer_coordinates=f"{delivery.latitude}, {delivery.longitude}" if delivery.latitude else None,
                        customer_id=actual_customer_id,
                        quantity=order_items[0].quantity if order_items else 1,
                        selected_color=order_items[0].variant_name if order_items else "Standard",
                        delivery_city=delivery.delivery_city,
                        unit_price=order_items[0].unit_price if order_items else total_amount,
                        total_amount=total_amount,
                        currency=order.currency,
                        status="CREATED",
                        client_status="PENDING",
                        coherence_status="HARMONIZED_PENDING"
                    )
                    db.add(intent)
            except Exception as e_intent:
                print("Notice: OrderIntent bridge skipped:", e_intent)

            # Create or link order conversation
            conv = ChatService.get_or_create_conversation(
                db=db,
                store_id=actual_store_id,
                context_type="ORDER",
                order_id=order.id,
                customer_id=actual_customer_id,
                customer_token=customer_token if _CS.is_guest_token(customer_token) else None,
                customer_name=customer_name
            )

            # Post initial interactive Order Card into conversation
            def format_item_summary(it):
                qty = it.quantity
                qty_str = f"{int(qty)}" if qty == int(qty) else f"{qty:g}".replace(".", ",")
                unit = (it.unit_label or "").strip()
                if unit and unit != "pièce" and unit != "pcs":
                    if qty > 1 and not unit.endswith("s") and not unit.endswith("x") and unit not in ["m", "cm", "kg", "g", "L", "ml", "h", "j"]:
                        unit = f"{unit}s"
                    return f"{it.product_name} ({qty_str} {unit})"
                elif qty > 1:
                    return f"{it.product_name} ({qty_str} pcs)"
                return f"{it.product_name} ({qty_str})"

            items_summary = ", ".join([format_item_summary(it) for it in order_items])
            order_card_metadata = {
                "order_id": order.id,
                "order_number": order.order_number,
                "total_amount": order.total_amount,
                "currency": order.currency,
                "items_count": len(order_items),
                "items_summary": items_summary,
                "items": [
                    {
                        "product_name": it.product_name,
                        "quantity": it.quantity,
                        "unit": it.unit,
                        "unit_label": it.unit_label,
                        "unit_price": it.unit_price,
                        "total_price": it.total_price,
                    }
                    for it in order_items
                ],
                "status": order.status,
                "payment_status": order.payment_status,
                "delivery_address": delivery.delivery_address,
                "has_gps": bool(delivery.latitude and delivery.longitude),
                "latitude": delivery.latitude,
                "longitude": delivery.longitude
            }

            ChatService.send_message(
                db=db,
                conversation_id=conv.id,
                sender_type="SYSTEM",
                sender_name="Système",
                content=f"📦 Nouvelle commande #{order.order_number} créée pour un total de {order.total_amount:,} {order.currency}. En attente de validation par le commerçant.",
                message_type="ORDER",
                metadata=order_card_metadata
            )

            # Audit log
            audit = AuditLog(
                id=str(uuid.uuid4()),
                event_name="ORDER_CREATED",
                actor_type="CUSTOMER",
                actor_id=customer_id or customer_token,
                actor_name=customer_name,
                resource_type="ORDER",
                resource_id=order.id,
                previous_state=None,
                new_state=order.status,
                metadata_json=json.dumps({"order_number": order.order_number, "total_amount": order.total_amount})
            )
            db.add(audit)

            # Access history touchpoint
            try:
                hist = StoreAccessHistory(
                    id=str(uuid.uuid4()),
                    store_id=actual_store_id,
                    customer_id=actual_customer_id,
                    guest_token=customer_token if _CS.is_guest_token(customer_token) else None,
                    interaction_type="ORDER",
                    last_interacted_at=utcnow()
                )
                db.add(hist)
            except Exception as e_hist:
                print("Notice: StoreAccessHistory skipped:", e_hist)

            db.commit()
            db.refresh(order)

            # Centralized notification dispatch to store owner
            try:
                NotificationEngine.notify_order_created(
                    db=db,
                    order=order,
                    store=store,
                    conversation_id=conv.id
                )
                db.commit()
            except Exception as e_notif:
                print("Notice: notify_order_created skipped:", e_notif)

            # Broadcast via WebSocket to store owner / user
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.created",
                "order_id": order.id,
                "order_number": order.order_number,
                "store_id": actual_store_id,
                "total_amount": order.total_amount,
                "currency": order.currency,
                "customer_name": customer_name,
                "conversation_id": conv.id
            })

            formatted = OrderService.format_order_dict(order, conversation_id=conv.id)
            # Jeton d'accès à CETTE commande, renvoyé uniquement à son créateur : il sert de preuve de
            # propriété (annulation, archivage) y compris pour un invité sans compte.
            formatted["access_token"] = _CS.expose(customer_token)
            if shop_discount:
                formatted["shop_discount"] = {k: shop_discount[k] for k in ("name", "percent", "amount")}
            if cust:
                formatted["customer_token"] = _CS.expose(customer_token)
                formatted["customer"] = {
                    "id": cust.id,
                    "name": cust.name,
                    "phone": cust.phone,
                    "city": cust.city,
                    "country": cust.country,
                    "delivery_neighborhood": cust.delivery_neighborhood,
                    "bonus_points": (cust.bonus_points or 0) / 10.0,
                }
            return formatted
        except Exception as e:
            db.rollback()
            raise e

    @staticmethod
    def accept_order(db: Session, order_id: str, seller_name: str = "Commerçant") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        prev_status = order.status
        order.status = "ACCEPTED"
        order.payment_status = "PAYMENT_PENDING"
        order.updated_at = utcnow()

        # Find conversation
        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content="✅ Votre commande a été acceptée par le vendeur. Vous pouvez maintenant effectuer le paiement et envoyer la preuve dans cette conversation.",
                metadata={"order_id": order.id, "status": "ACCEPTED", "payment_status": "PAYMENT_PENDING"}
            )

        # Audit
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_ACCEPTED",
            actor_type="MERCHANT",
            actor_name=seller_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state="ACCEPTED"
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Notify customer
        try:
            NotificationEngine.notify_order_accepted(
                db=db,
                order=order,
                store=order.store,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_accepted failed:", e)

        # Broadcast
        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": "ACCEPTED",
                "payment_status": "PAYMENT_PENDING"
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def reject_order(db: Session, order_id: str, reason: Optional[str] = None, seller_name: str = "Commerçant") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        prev_status = order.status
        if prev_status in OrderService._FINAL_STATES:
            raise ValueError(f"Commande déjà {prev_status} : refus impossible.")
        order.status = "REJECTED"
        order.rejection_reason = reason or "Indisponibilité temporaire des ingrédients"
        order.updated_at = utcnow()
        sync_delivery_status(order)
        OrderService._release_order_resources(db, order, order.rejection_reason)

        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            msg = f"❌ La commande a été refusée par le vendeur. Motif : {order.rejection_reason}"
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=msg,
                metadata={"order_id": order.id, "status": "REJECTED", "reason": order.rejection_reason}
            )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_REJECTED",
            actor_type="MERCHANT",
            actor_name=seller_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state="REJECTED",
            metadata_json=json.dumps({"reason": order.rejection_reason})
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Notify customer
        try:
            NotificationEngine.notify_order_rejected(
                db=db,
                order=order,
                store=order.store,
                reason=order.rejection_reason,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_rejected failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": "REJECTED",
                "reason": order.rejection_reason
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def update_order_status(db: Session, order_id: str, new_status: str, notes: Optional[str] = None, actor_name: str = "Commerçant") -> Dict[str, Any]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise ValueError(f"Order {order_id} not found")

        prev_status = order.status
        if prev_status == new_status:
            return OrderService.format_order_dict(order)
        if prev_status in OrderService._FINAL_STATES:
            raise ValueError(f"Commande déjà {prev_status} : changement de statut vers {new_status} refusé.")
        order.status = new_status
        order.updated_at = utcnow()
        sync_delivery_status(order)
        if new_status in OrderService._TERMINAL_CANCELLED:
            OrderService._release_order_resources(db, order, notes)

        status_messages = {
            "PREPARING": "👨‍🍳 Commande en cours de préparation en cuisine !",
            "READY_FOR_DELIVERY": "🥡 Commande prête et emballée ! En attente du coursier.",
            "OUT_FOR_DELIVERY": "🛵 La commande est en route vers votre lieu de livraison.",
            "DELIVERED": "📍 Commande livrée avec succès ! Bon appétit.",
            "COMPLETED": "🎉 Commande terminée et archivée avec succès. Merci pour votre confiance !"
        }

        content = status_messages.get(new_status, f"Statut de la commande mis à jour : {new_status}")
        if notes:
            content += f" ({notes})"

        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=content,
                metadata={"order_id": order.id, "status": new_status, "notes": notes}
            )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_STATUS_CHANGED",
            actor_type="MERCHANT",
            actor_name=actor_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state=new_status,
            metadata_json=json.dumps({"notes": notes})
        )
        db.add(audit)

        # 1. Release escrow and credit customer loyalty points upon delivery
        if new_status in ("DELIVERED", "COMPLETED", "LIVREE"):
            try:
                from app.services.wallet_service import WalletService
                WalletService.release_escrow(db, order.store_id, order.id)
            except Exception as e_w:
                print("Notice: wallet release_escrow skipped:", e_w)

            try:
                if order.customer_id and getattr(order.store, "is_loyalty_active", True) is not False:
                    from app.services.loyalty_v3 import credit_for_delivery
                    credit_for_delivery(db, order)
            except Exception as e_lp:
                print("Notice: loyalty credit_points skipped:", e_lp)
        elif new_status in ("CANCELLED", "ANNULEE", "REJECTED"):
            try:
                from app.services.wallet_service import WalletService
                WalletService.refund_escrow(db, order.store_id, order.id, reason=notes or "Commande annulée/refusée")
            except Exception as e_rf:
                print("Notice: wallet refund_escrow skipped:", e_rf)

        db.commit()
        db.refresh(order)

        # Notify customer
        try:
            NotificationEngine.notify_order_status_updated(
                db=db,
                order=order,
                store=order.store,
                new_status=new_status,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_status_updated failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": new_status
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def cancel_order(db: Session, order_id: str, reason: Optional[str] = "Annulé par le client", actor_name: str = "Client") -> Dict[str, Any]:
        order = db.query(Order).filter(
            (Order.id == order_id) | (Order.order_number == order_id)
        ).first()

        if not order:
            from app.models.commerce import OrderIntent
            intent = db.query(OrderIntent).filter(
                (OrderIntent.id == order_id) | (OrderIntent.reference_code == order_id)
            ).first()
            if intent:
                intent.status = "CANCELLED"
                intent.client_status = "CANCELLED"
                intent.client_feedback = reason or "Annulé par le client"
                intent.client_action_at = utcnow()
                db.commit()
                db.refresh(intent)
                return {
                    "id": intent.id,
                    "order_number": intent.reference_code,
                    "reference_code": intent.reference_code,
                    "status": "CANCELLED",
                    "client_status": "CANCELLED",
                    "total_amount": intent.total_amount,
                    "currency": intent.currency,
                    "customer_name": intent.customer_name,
                    "customer_phone": intent.customer_phone,
                    "is_client_archived": bool(getattr(intent, "is_client_archived", False)),
                    "is_client_hidden": bool(getattr(intent, "is_client_hidden", False)),
                }
            raise ValueError(f"Commande {order_id} introuvable")

        prev_status = order.status
        if prev_status in OrderService._TERMINAL_CANCELLED:
            return OrderService.format_order_dict(order)  # déjà annulée/refusée : pas de second remboursement de stock
        if prev_status in ("DELIVERED", "COMPLETED", "LIVREE"):
            raise ValueError("Cette commande est déjà livrée et ne peut plus être annulée.")
        order.status = "CANCELLED"
        order.rejection_reason = reason or "Annulé par le client"
        order.updated_at = utcnow()
        sync_delivery_status(order)

        OrderService._release_order_resources(db, order, order.rejection_reason)

        # Update linked conversation
        conv = db.query(Conversation).filter(Conversation.order_id == order.id).first()
        if conv:
            msg = f"❌ La commande #{order.order_number} a été annulée. Motif : {order.rejection_reason}"
            ChatService.post_system_message(
                db=db,
                conversation_id=conv.id,
                content=msg,
                metadata={"order_id": order.id, "status": "CANCELLED", "reason": order.rejection_reason}
            )

        # Also sync linked OrderIntent if any
        from app.models.commerce import OrderIntent
        linked_intent = db.query(OrderIntent).filter(OrderIntent.reference_code == order.order_number).first()
        if linked_intent:
            linked_intent.status = "CANCELLED"
            linked_intent.client_status = "CANCELLED"
            linked_intent.client_feedback = order.rejection_reason
            linked_intent.client_action_at = utcnow()

        # Audit log
        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="ORDER_CANCELLED",
            actor_type="CUSTOMER" if "client" in (actor_name or "").lower() else "MERCHANT",
            actor_name=actor_name,
            resource_type="ORDER",
            resource_id=order.id,
            previous_state=prev_status,
            new_state="CANCELLED",
            metadata_json=json.dumps({"reason": order.rejection_reason})
        )
        db.add(audit)
        db.commit()
        db.refresh(order)

        # Centralized notification dispatch
        try:
            NotificationEngine.notify_order_cancelled(
                db=db,
                order=order,
                store=order.store,
                reason=order.rejection_reason,
                cancelled_by=actor_name,
                conversation_id=conv.id if conv else None
            )
            db.commit()
        except Exception as e:
            print("Notice: notify_order_cancelled failed:", e)

        if conv:
            manager.safe_broadcast_sync(conv.id, {
                "type": "order.status_updated",
                "order_id": order.id,
                "status": "CANCELLED",
                "reason": order.rejection_reason
            })

        return OrderService.format_order_dict(order)

    @staticmethod
    def archive_order_client(db: Session, order_id: str, is_archived: bool = True) -> Dict[str, Any]:
        """
        Soft-archive an order from client perspective.
        The order is moved to archived view for the user, but stays 100% intact in database for seller, audit and analytics.
        """
        order = db.query(Order).filter(
            (Order.id == order_id) | (Order.order_number == order_id)
        ).first()
        if order:
            order.is_client_archived = is_archived
            order.updated_at = utcnow()
            from app.models.commerce import OrderIntent
            linked_intent = db.query(OrderIntent).filter(OrderIntent.reference_code == order.order_number).first()
            if linked_intent:
                linked_intent.is_client_archived = is_archived
                linked_intent.is_archived = is_archived
                linked_intent.updated_at = utcnow()
            db.commit()
            db.refresh(order)
            return {
                "success": True,
                "id": order.id,
                "order_number": order.order_number,
                "is_client_archived": order.is_client_archived,
                "message": "Commande archivée avec succès." if is_archived else "Commande désarchivée avec succès."
            }

        from app.models.commerce import OrderIntent
        intent = db.query(OrderIntent).filter(
            (OrderIntent.id == order_id) | (OrderIntent.reference_code == order_id)
        ).first()
        if intent:
            intent.is_client_archived = is_archived
            intent.is_archived = is_archived
            intent.updated_at = utcnow()
            db.commit()
            db.refresh(intent)
            return {
                "success": True,
                "id": intent.id,
                "order_number": intent.reference_code,
                "is_client_archived": intent.is_client_archived,
                "message": "Commande archivée avec succès." if is_archived else "Commande désarchivée avec succès."
            }

        raise ValueError(f"Commande {order_id} introuvable")

    @staticmethod
    def hide_order_client(db: Session, order_id: str) -> Dict[str, Any]:
        """
        Soft-delete for the user ("suppression définitive pour l'utilisateur sans rien effacer en base de donnée").
        Hides the order permanently from the client's screen/history.
        Preserves 100% of the row in the database for the merchant, financial reports, arbitration, and SuperAdmin.
        """
        order = db.query(Order).filter(
            (Order.id == order_id) | (Order.order_number == order_id)
        ).first()
        if order:
            order.is_client_hidden = True
            order.updated_at = utcnow()
            from app.models.commerce import OrderIntent
            linked_intent = db.query(OrderIntent).filter(OrderIntent.reference_code == order.order_number).first()
            if linked_intent:
                linked_intent.is_client_hidden = True
                linked_intent.updated_at = utcnow()
            db.commit()
            db.refresh(order)
            return {
                "success": True,
                "id": order.id,
                "order_number": order.order_number,
                "is_client_hidden": True,
                "message": "Commande retirée de votre historique avec succès."
            }

        from app.models.commerce import OrderIntent
        intent = db.query(OrderIntent).filter(
            (OrderIntent.id == order_id) | (OrderIntent.reference_code == order_id)
        ).first()
        if intent:
            intent.is_client_hidden = True
            intent.updated_at = utcnow()
            db.commit()
            db.refresh(intent)
            return {
                "success": True,
                "id": intent.id,
                "order_number": intent.reference_code,
                "is_client_hidden": True,
                "message": "Commande retirée de votre historique avec succès."
            }

        raise ValueError(f"Commande {order_id} introuvable")

    @staticmethod
    def list_orders(
        db: Session,
        store_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_token: Optional[str] = None,
        status: Optional[str] = None,
        include_hidden: bool = False
    ) -> List[Dict[str, Any]]:
        query = db.query(Order)
        if store_id:
            query = query.filter(Order.store_id == store_id)
        if customer_id or customer_token:
            # Combine customer_id, customer_token, and matching customer phone
            conditions = []
            cust_phones = []
            if customer_id:
                conditions.append(Order.customer_id == customer_id)
                cust_by_id = db.query(Customer).filter(Customer.id == customer_id).first()
                if cust_by_id and cust_by_id.phone:
                    cust_phones.append(cust_by_id.phone)
            if customer_token:
                from app.services.customer_service import CustomerService as _CS2
                conditions.append(Order.customer_token == customer_token)
                cust_by_token = _CS2.get_by_token(db, customer_token)
                if cust_by_token:
                    conditions.append(Order.customer_id == cust_by_token.id)
                    if cust_by_token.phone:
                        cust_phones.append(cust_by_token.phone)
            for p in set(cust_phones):
                if p:
                    conditions.append(Order.customer_phone == p)
            query = query.filter(or_(*conditions))
            if not include_hidden:
                query = query.filter((Order.is_client_hidden.is_(False) | Order.is_client_hidden.is_(None)))
        elif not store_id:
            # No credentials or store filter provided: do not expose system orders
            return []
        if status:
            query = query.filter(Order.status == status)

        orders = query.order_by(desc(Order.created_at)).all()
        return [OrderService.format_order_dict(o) for o in orders]

    @staticmethod
    def get_order_by_id(db: Session, order_id: str) -> Optional[Dict[str, Any]]:
        order = db.query(Order).filter(Order.id == order_id).first()
        if not order:
            return None
        return OrderService.format_order_dict(order)

    @staticmethod
    def format_order_dict(order: Order, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        conv_id = conversation_id
        if not conv_id and order.conversations:
            conv_id = order.conversations[0].id

        delivery_info = None
        if order.delivery:
            delivery_info = {
                "id": order.delivery.id,
                "delivery_mode": order.delivery.delivery_mode,
                "delivery_city": order.delivery.delivery_city,
                "delivery_address": order.delivery.delivery_address,
                "latitude": order.delivery.latitude,
                "longitude": order.delivery.longitude,
                "location_accuracy": order.delivery.location_accuracy,
                "delivery_notes": order.delivery.delivery_notes,
                "fulfillment_type": order.delivery.fulfillment_type or "HOME",
                "location_status": order.delivery.location_status,
                "location_distance_km": order.delivery.location_distance_km,
                "spot_id": order.delivery.spot_id,
                "spot": _load_json(order.delivery.spot_snapshot),
                "delivery_status": order.delivery.delivery_status,
                "maps_url": f"https://maps.google.com/?q={order.delivery.latitude},{order.delivery.longitude}" if order.delivery.latitude else None
            }

        items_info = []
        for it in (order.items or []):
            opts = None
            if it.customization_options:
                try:
                    opts = json.loads(it.customization_options)
                except Exception:
                    opts = it.customization_options

            measurements = None
            if getattr(it, "measurements", None):
                try:
                    measurements = json.loads(it.measurements)
                except Exception:
                    measurements = it.measurements

            snapshot = None
            if getattr(it, "sales_config_snapshot", None):
                try:
                    snapshot = json.loads(it.sales_config_snapshot)
                except Exception:
                    snapshot = it.sales_config_snapshot

            items_info.append({
                "id": it.id,
                "product_id": it.product_id,
                "variant_id": it.variant_id,
                "product_name": it.product_name,
                "variant_name": it.variant_name,
                "quantity": it.quantity,
                "unit": getattr(it, "unit", "PIECE") or "PIECE",
                "unit_label": getattr(it, "unit_label", "pièce") or "pièce",
                "unit_price": it.unit_price,
                "total_price": it.total_price,
                "pricing_model": getattr(it, "pricing_model", "FIXED_PER_UNIT") or "FIXED_PER_UNIT",
                "measurements": measurements,
                "sales_config_snapshot": snapshot,
                "is_customized": it.is_customized,
                "customization_text": it.customization_text,
                "customization_options": opts,
                "primary_image_url": getattr(it.product, "primary_image_url", None) if getattr(it, "product", None) else None,
            })

        latest_payment = order.payments[-1] if order.payments else None
        payment_info = None
        if latest_payment:
            proofs_info = [
                {
                    "id": p.id,
                    "file_url": p.file_url,
                    "file_name": p.file_name,
                    "mime_type": p.mime_type,
                    "file_size": p.file_size,
                    "status": p.status,
                    "customer_note": p.customer_note,
                    "verified_at": p.verified_at.isoformat() if p.verified_at else None,
                    "created_at": p.created_at.isoformat() if p.created_at else None
                }
                for p in latest_payment.proofs
            ]
            payment_info = {
                "id": latest_payment.id,
                "amount": latest_payment.amount,
                "currency": latest_payment.currency,
                "status": latest_payment.status,
                "payment_method": latest_payment.payment_method,
                "transaction_reference": latest_payment.transaction_reference,
                "confirmed_at": latest_payment.confirmed_at.isoformat() if latest_payment.confirmed_at else None,
                "rejection_reason": latest_payment.rejection_reason,
                "proofs": proofs_info
            }

        store_name = ""
        store_slug = ""
        try:
            if order.store:
                store_name = order.store.name or ""
                store_slug = order.store.slug or ""
        except Exception:
            pass

        return {
            "id": order.id,
            "order_number": order.order_number,
            "store_id": order.store_id,
            "store_name": store_name,
            "store_slug": store_slug,
            "customer_id": order.customer_id,
            "customer_name": order.customer_name,
            "customer_phone": order.customer_phone,
            "customer_email": order.customer_email,
            "status": order.status,
            "payment_status": order.payment_status,
            "subtotal_amount": order.subtotal_amount,
            "delivery_fee": order.delivery_fee,
            "discount_amount": order.discount_amount,
            "total_amount": order.total_amount,
            "currency": order.currency,
            "notes": order.notes,
            "rejection_reason": order.rejection_reason,
            "is_client_archived": bool(getattr(order, "is_client_archived", False)),
            "is_client_hidden": bool(getattr(order, "is_client_hidden", False)),
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "updated_at": order.updated_at.isoformat() if order.updated_at else None,
            "conversation_id": conv_id,
            "items": items_info,
            "delivery": delivery_info,
            "payment": payment_info
        }
