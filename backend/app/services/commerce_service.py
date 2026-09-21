import random
import string
import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.commerce import OrderIntent, SaleConfirmation
from app.models.followup import FollowUpTask
from app.models.store import Store
from app.models.catalog import Product
from app.models.channels import StoreChannel
from app.models.analytics import TrackingEvent
from app.schemas.commerce import CreateIntentRequest, ConfirmSaleRequest, ClientOrderActionRequest, ResolveDiscrepancyRequest
from app.services.notification_service import NotificationService
from app.adapters.factory import get_channel_adapter

class CommerceService:
    @staticmethod
    def generate_reference_code() -> str:
        chars = string.ascii_uppercase + string.digits
        random_suffix = "".join(random.choices(chars, k=6))
        return f"CMD-{random_suffix}"

    @classmethod
    def create_order_intent(cls, db: Session, req: CreateIntentRequest) -> Tuple[OrderIntent, str, str, str]:
        store = db.query(Store).filter(Store.id == req.store_id).first()
        product = db.query(Product).filter(Product.id == req.product_id).first()
        if not store or not product:
            raise ValueError("Boutique ou Produit introuvable")

        # Determine channel
        channel = db.query(StoreChannel).filter(
            StoreChannel.store_id == req.store_id,
            StoreChannel.channel_type == req.channel_type.upper(),
            StoreChannel.is_active == True
        ).first()

        account_handle = channel.account_handle if channel else "2250700000000"
        channel_id = channel.id if channel else None

        reference_code = cls.generate_reference_code()
        unit_price = product.price
        total_amount = unit_price * req.quantity

        intent = OrderIntent(
            reference_code=reference_code,
            store_id=req.store_id,
            product_id=req.product_id,
            channel_id=channel_id,
            channel_type=req.channel_type.upper(),
            customer_id=req.customer_id,
            customer_name=req.customer_name,
            customer_phone=req.customer_phone,
            customer_source=req.customer_source or "DIRECT",
            customer_location_url=req.customer_location_url,
            customer_coordinates=req.customer_coordinates,
            quantity=req.quantity,
            selected_color=req.selected_color,
            delivery_city=req.delivery_city or "Abidjan",
            unit_price=unit_price,
            total_amount=total_amount,
            currency=product.currency,
            status="CREATED",
            client_status="PENDING",
            coherence_status="HARMONIZED_PENDING",
            coherence_notes="Commande créée, en attente de discussion et d'arbitrage 24h.",
            redirected_at=datetime.utcnow(),
        )
        db.add(intent)
        db.flush()

        # Create FollowUpTask (24h later)
        secure_token = secrets.token_urlsafe(32)
        followup = FollowUpTask(
            order_intent_id=intent.id,
            secure_token=secure_token,
            scheduled_for=datetime.utcnow() + timedelta(hours=24),
            status="SCHEDULED",
        )
        db.add(followup)

        # Record TrackingEvent
        event = TrackingEvent(
            store_id=req.store_id,
            product_id=req.product_id,
            event_type="ADD_INTENT",
            channel_type=req.channel_type.upper(),
            source=req.customer_source or "DIRECT",
        )
        db.add(event)

        # Update product discussions & views
        product.active_discussions_count += 1
        db.commit()
        db.refresh(intent)

        # Polymorphic Adapter format
        adapter = get_channel_adapter(req.channel_type)
        context = {
            "product_name": product.name,
            "quantity": req.quantity,
            "selected_color": req.selected_color,
            "delivery_city": req.delivery_city or "Abidjan",
            "reference_code": reference_code,
            "total_amount": total_amount,
            "currency": product.currency,
            "owner_name": store.name,
            "customer_location_url": req.customer_location_url,
            "customer_coordinates": req.customer_coordinates,
        }
        prefilled_msg = adapter.format_message(context)
        redirect_url = adapter.build_redirect_url(account_handle, context)

        return intent, redirect_url, prefilled_msg, secure_token

    @staticmethod
    def get_pending_followups(db: Session, store_id: str) -> List[OrderIntent]:
        return db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            OrderIntent.status.in_(["CREATED", "REDIRECTED", "PENDING_24H"])
        ).order_by(OrderIntent.created_at.desc()).all()

    @staticmethod
    def get_intent_feed(
        db: Session,
        store_id: str,
        limit: Optional[int] = None,
        include_archived: bool = False,
        search: Optional[str] = None,
        channel: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[OrderIntent]:
        query = db.query(OrderIntent).filter(OrderIntent.store_id == store_id)
        if not include_archived:
            query = query.filter(OrderIntent.is_archived == False)
        if channel and channel != "ALL":
            query = query.filter(OrderIntent.channel_type == channel)
        if status and status != "ALL":
            if status == "SATISFIED":
                query = query.filter(OrderIntent.client_status == "SATISFIED")
            elif status == "CANCELLED":
                query = query.filter(
                    (OrderIntent.status == "CANCELLED") | (OrderIntent.client_status == "CANCELLED")
                )
            else:
                query = query.filter(OrderIntent.status == status)
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                (OrderIntent.reference_code.ilike(term))
                | (OrderIntent.customer_name.ilike(term))
                | (OrderIntent.customer_phone.ilike(term))
                | (OrderIntent.channel_type.ilike(term))
                | (OrderIntent.delivery_city.ilike(term))
            )
        query = query.order_by(OrderIntent.created_at.desc())
        if limit and limit > 0:
            query = query.limit(limit)
        return query.all()

    @staticmethod
    def toggle_archive_intent(db: Session, intent_id: str) -> Optional[OrderIntent]:
        intent = db.query(OrderIntent).filter(OrderIntent.id == intent_id).first()
        if not intent:
            return None
        intent.is_archived = not bool(intent.is_archived)
        db.commit()
        db.refresh(intent)
        return intent

    @staticmethod
    def delete_intent(db: Session, intent_id: str) -> bool:
        intent = db.query(OrderIntent).filter(OrderIntent.id == intent_id).first()
        if not intent:
            return False
        db.delete(intent)
        db.commit()
        return True

    @staticmethod
    def get_discrepancies(db: Session, store_id: str) -> List[OrderIntent]:
        return db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            OrderIntent.coherence_status.in_(["DISCREPANCY_CONFLICT", "DISCREPANCY_SURPRISE"])
        ).order_by(OrderIntent.updated_at.desc()).all()

    @staticmethod
    def get_by_reference(db: Session, reference_code: str) -> Optional[OrderIntent]:
        norm = reference_code.strip().upper()
        if not norm.startswith("CMD-") and len(norm) == 6:
            norm = f"CMD-{norm}"
        return db.query(OrderIntent).filter(OrderIntent.reference_code == norm).first()

    @staticmethod
    def get_intents_by_ids(db: Session, ids: List[str]) -> List[OrderIntent]:
        if not ids:
            return []
        return db.query(OrderIntent).filter(OrderIntent.id.in_(ids)).order_by(OrderIntent.created_at.desc()).all()

    @classmethod
    def confirm_sale(cls, db: Session, intent_id: str, confirmation: ConfirmSaleRequest) -> OrderIntent:
        intent = db.query(OrderIntent).filter(OrderIntent.id == intent_id).first()
        if not intent:
            raise ValueError("Intention introuvable")

        was_already_sold = (intent.status == "SOLD")

        # Create or update SaleConfirmation
        existing_conf = db.query(SaleConfirmation).filter(SaleConfirmation.order_intent_id == intent_id).first()
        if not existing_conf:
            existing_conf = SaleConfirmation(
                order_intent_id=intent_id,
                is_sold=confirmation.is_sold,
                reason=confirmation.reason,
                amount_paid=confirmation.amount_paid or (intent.total_amount if confirmation.is_sold else 0),
                confirmed_at=datetime.utcnow()
            )
            db.add(existing_conf)
        else:
            existing_conf.is_sold = confirmation.is_sold
            existing_conf.reason = confirmation.reason
            existing_conf.amount_paid = confirmation.amount_paid or (intent.total_amount if confirmation.is_sold else 0)
            existing_conf.confirmed_at = datetime.utcnow()

        if confirmation.is_sold:
            intent.status = "SOLD"
            # Update product sales count and stock only if it wasn't already marked sold
            if not was_already_sold:
                if intent.product:
                    intent.product.sales_count += intent.quantity
                    intent.product.revenue += intent.total_amount
                    intent.product.stock = max(0, intent.product.stock - intent.quantity)
                if intent.store:
                    intent.store.sales_count += 1
                    intent.store.revenue += intent.total_amount
                db.add(TrackingEvent(
                    store_id=intent.store_id,
                    product_id=intent.product_id,
                    event_type="SALE_CONFIRM",
                    channel_type=intent.channel_type,
                ))

            # Coherence check against client status
            if intent.client_status == "SATISFIED":
                intent.coherence_status = "CONSOLIDATED_SALE"
                intent.coherence_notes = "Vente parfaite : confirmée par la commerçante et client satisfait."
            elif intent.client_status == "CANCELLED":
                intent.coherence_status = "DISCREPANCY_CONFLICT"
                intent.coherence_notes = f"Incohérence : Vente confirmée par la commerçante mais annulée par le client ({intent.client_feedback or 'Sans motif'})."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="DISCREPANCY_CONFLICT",
                    urgency="HIGH",
                    title=f"⚠️ Incohérence sur #{intent.reference_code}",
                    message=f"Vous avez validé la vente #{intent.reference_code}, mais le client a signalé une annulation. Veuillez arbitrer ce litige.",
                    action_type="RESOLVE_DISCREPANCY"
                )
            else:
                intent.coherence_status = "MERCHANT_CONFIRMED_CLIENT_PENDING"
                intent.coherence_notes = "Vente validée par la commerçante, en attente de retour de satisfaction client."

        else:
            # If was sold previously, adjust stock and revenue back
            if was_already_sold:
                if intent.product:
                    intent.product.sales_count = max(0, intent.product.sales_count - intent.quantity)
                    intent.product.revenue = max(0, intent.product.revenue - intent.total_amount)
                    intent.product.stock += intent.quantity
                if intent.store:
                    intent.store.sales_count = max(0, intent.store.sales_count - 1)
                    intent.store.revenue = max(0, intent.store.revenue - intent.total_amount)

            intent.status = "NOT_SOLD"
            db.add(TrackingEvent(
                store_id=intent.store_id,
                product_id=intent.product_id,
                event_type="SALE_REJECT",
                channel_type=intent.channel_type,
            ))

            # Coherence check against client status
            if intent.client_status == "SATISFIED":
                intent.coherence_status = "DISCREPANCY_SURPRISE"
                intent.coherence_notes = "Incohérence : Vente notée abandon par la commerçante, mais le client indique être satisfait(e)."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="DISCREPANCY_SURPRISE",
                    urgency="MEDIUM",
                    title=f"💡 Requalification possible #{intent.reference_code}",
                    message=f"Vous aviez marqué abandon pour #{intent.reference_code}, mais le client se déclare satisfait(e). Requalifiez en vente conclue si le paiement a eu lieu.",
                    action_type="RESOLVE_DISCREPANCY"
                )
            elif intent.client_status == "CANCELLED":
                intent.coherence_status = "MUTUAL_ABANDON"
                intent.coherence_notes = "Abandon d'un commun accord commerçante et client."
            else:
                intent.coherence_status = "MUTUAL_ABANDON"
                intent.coherence_notes = "Abandon noté par la commerçante."

        if intent.followup_task:
            intent.followup_task.status = "CONFIRMED" if confirmation.is_sold else "REJECTED"
            intent.followup_task.responded_at = datetime.utcnow()

        db.commit()
        db.refresh(intent)
        return intent

    @classmethod
    def record_client_action(cls, db: Session, intent_id_or_ref: str, req: ClientOrderActionRequest) -> OrderIntent:
        intent = db.query(OrderIntent).filter(
            (OrderIntent.id == intent_id_or_ref) | (OrderIntent.reference_code == intent_id_or_ref.upper())
        ).first()
        if not intent:
            raise ValueError("Commande introuvable")

        action_upper = req.action.strip().upper()
        prod_title = intent.product.name if intent.product else "Produit"
        cust_display = intent.customer_name or "Le client"

        if action_upper == "SATISFY":
            intent.client_status = "SATISFIED"
            intent.client_feedback = req.reason or "Client très satisfait(e)"
            intent.client_satisfaction_rating = req.rating or 5
            intent.client_action_at = datetime.utcnow()

            # Check coherence with merchant status
            has_conf = intent.sale_confirmation is not None
            is_sold = intent.sale_confirmation.is_sold if has_conf else False

            if has_conf and is_sold:
                intent.coherence_status = "CONSOLIDATED_SALE"
                intent.coherence_notes = "Vente parfaite : confirmée par la commerçante et client satisfait."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="CLIENT_SATISFIED",
                    urgency="LOW",
                    title=f"⭐ Client Satisfait #{intent.reference_code}",
                    message=f"{cust_display} confirme avoir reçu {prod_title} et est satisfait(e) ({intent.client_satisfaction_rating}★). Vente 100% consolidée !",
                    action_type="VIEW_ORDER"
                )
            elif has_conf and not is_sold:
                intent.coherence_status = "DISCREPANCY_SURPRISE"
                intent.coherence_notes = "Incohérence : Commerçante avait noté abandon mais le client indique être satisfait."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="DISCREPANCY_SURPRISE",
                    urgency="HIGH",
                    title=f"⚠️ Requalification requise #{intent.reference_code}",
                    message=f"{cust_display} a marqué #{intent.reference_code} comme Satisfait(e), alors qu'elle était classée en abandon. Cliquez pour valider le CA.",
                    action_type="RESOLVE_DISCREPANCY"
                )
            else: # Merchant has not confirmed yet!
                intent.coherence_status = "CLIENT_CONFIRMED_PENDING_MERCHANT"
                intent.coherence_notes = "Client satisfait ! En attente de confirmation commerçante de la vente réelle."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="CLIENT_SATISFIED",
                    urgency="HIGH",
                    title=f"⭐ Client Satisfait sur #{intent.reference_code}",
                    message=f"{cust_display} a marqué la commande #{intent.reference_code} ({prod_title}) comme Satisfait(e) ! Confirmez-vous la vente réelle pour encaisser le CA de {intent.total_amount:,} {intent.currency} ?",
                    action_type="CONFIRM_SALE"
                )

        elif action_upper == "CANCEL":
            intent.client_status = "CANCELLED"
            intent.client_feedback = req.reason or "Annulé par le client"
            intent.client_action_at = datetime.utcnow()

            has_conf = intent.sale_confirmation is not None
            is_sold = intent.sale_confirmation.is_sold if has_conf else False

            if has_conf and is_sold:
                intent.coherence_status = "DISCREPANCY_CONFLICT"
                intent.coherence_notes = f"Incohérence : Commerçante a validé la vente mais le client a annulé ('{intent.client_feedback}')."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="DISCREPANCY_CONFLICT",
                    urgency="HIGH",
                    title=f"🚨 Incohérence / Litige #{intent.reference_code}",
                    message=f"Attention : Vous aviez validé la vente #{intent.reference_code}, mais le client a déclaré avoir annulé la commande (Motif: '{intent.client_feedback}'). Veuillez arbitrer ce litige.",
                    action_type="RESOLVE_DISCREPANCY"
                )
            elif has_conf and not is_sold:
                intent.coherence_status = "MUTUAL_ABANDON"
                intent.coherence_notes = "Abandon d'un commun accord commerçante et client."
            else:
                intent.status = "CANCELLED"
                intent.coherence_status = "CLIENT_CANCELLED_EARLY"
                intent.coherence_notes = f"Commande annulée par le client avant validation ({intent.client_feedback})."
                NotificationService.create_notification(
                    db=db,
                    store_id=intent.store_id,
                    order_intent_id=intent.id,
                    notification_type="CLIENT_CANCELLED",
                    urgency="MEDIUM",
                    title=f"❌ Commande #{intent.reference_code} Annulée",
                    message=f"{cust_display} a annulé sa commande #{intent.reference_code} pour {prod_title} (Motif : '{intent.client_feedback}'). Pas besoin de relancer.",
                    action_type="VIEW_ORDER"
                )
        else:
            raise ValueError(f"Action '{req.action}' invalide. Utilisez 'SATISFY' ou 'CANCEL'.")

        db.commit()
        db.refresh(intent)
        return intent

    @classmethod
    def resolve_discrepancy(cls, db: Session, intent_id: str, req: ResolveDiscrepancyRequest) -> OrderIntent:
        intent = db.query(OrderIntent).filter(OrderIntent.id == intent_id).first()
        if not intent:
            raise ValueError("Intention introuvable")

        res_upper = req.resolution.strip().upper()
        was_sold_previously = (intent.status == "SOLD") or (intent.sale_confirmation and intent.sale_confirmation.is_sold)

        if res_upper == "ACCEPT_CANCELLATION":
            # Merchant accepts cancellation / returns product
            if was_sold_previously:
                if intent.product:
                    intent.product.sales_count = max(0, intent.product.sales_count - intent.quantity)
                    intent.product.revenue = max(0, intent.product.revenue - intent.total_amount)
                    intent.product.stock += intent.quantity
                if intent.store:
                    intent.store.sales_count = max(0, intent.store.sales_count - 1)
                    intent.store.revenue = max(0, intent.store.revenue - intent.total_amount)

            intent.status = "CANCELLED"
            if not intent.sale_confirmation:
                intent.sale_confirmation = SaleConfirmation(
                    order_intent_id=intent.id,
                    is_sold=False,
                    reason=req.notes or "Annulation acceptée après conciliation",
                    confirmed_at=datetime.utcnow()
                )
                db.add(intent.sale_confirmation)
            else:
                intent.sale_confirmation.is_sold = False
                intent.sale_confirmation.reason = req.notes or "Annulation acceptée après conciliation"
                intent.sale_confirmation.confirmed_at = datetime.utcnow()

            intent.coherence_status = "MUTUAL_ABANDON"
            intent.coherence_notes = f"Incohérence arbitrée : annulation validée par la commerçante. {req.notes or ''}".strip()

        elif res_upper == "FORCE_CONFIRM_SALE":
            # Merchant confirms delivery happened
            if not was_sold_previously:
                if intent.product:
                    intent.product.sales_count += intent.quantity
                    intent.product.revenue += intent.total_amount
                    intent.product.stock = max(0, intent.product.stock - intent.quantity)
                if intent.store:
                    intent.store.sales_count += 1
                    intent.store.revenue += intent.total_amount

            intent.status = "SOLD"
            if not intent.sale_confirmation:
                intent.sale_confirmation = SaleConfirmation(
                    order_intent_id=intent.id,
                    is_sold=True,
                    reason=req.notes or "Vente maintenue sur justificatif",
                    confirmed_at=datetime.utcnow()
                )
                db.add(intent.sale_confirmation)
            else:
                intent.sale_confirmation.is_sold = True
                intent.sale_confirmation.reason = req.notes or "Vente maintenue sur justificatif"
                intent.sale_confirmation.confirmed_at = datetime.utcnow()

            intent.coherence_status = "MANUALLY_RESOLVED_SALE"
            intent.coherence_notes = f"Incohérence arbitrée : vente confirmée par la commerçante. {req.notes or ''}".strip()
        else:
            raise ValueError(f"Résolution '{req.resolution}' inconnue. Utilisez 'ACCEPT_CANCELLATION' ou 'FORCE_CONFIRM_SALE'.")

        db.commit()
        db.refresh(intent)
        return intent

    @classmethod
    def confirm_by_token(cls, db: Session, token: str, is_sold: bool, reason: Optional[str] = None) -> OrderIntent:
        followup = db.query(FollowUpTask).filter(FollowUpTask.secure_token == token).first()
        if not followup:
            raise ValueError("Jeton de relance invalide ou expiré")
        return cls.confirm_sale(db, followup.order_intent_id, ConfirmSaleRequest(is_sold=is_sold, reason=reason))
