import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.notifications import AppNotification
from app.models.store import Store, StoreSubscription
from app.models.customer import Customer
from app.models.order import Order
from app.models.payment import PaymentProof
from app.services.capability_service import CapabilityService, CAP_ORDERING, CAP_PAYMENT_PROOF, CAP_DELIVERY
from app.realtime.connection_manager import manager


class NotificationEngine:
    """
    Centralized event-driven notification engine for GotoShop.
    Dispatches notifications to customers, store owners, and followers.
    Respects capability toggles and non-intrusive decision support guidelines.
    """

    @staticmethod
    def dispatch(
        db: Session,
        recipient_type: str,  # "STORE_OWNER", "CUSTOMER", "SUBSCRIBER", "ALL"
        recipient_id: str,
        title: str,
        message: str,
        category: str = "TRANSACTIONAL",  # "TRANSACTIONAL", "STORE_NEWS", "RELATIONAL", "BUSINESS_ASSISTANCE", "OPERATIONAL"
        event_type: str = "GENERIC_EVENT",
        urgency: str = "MEDIUM",  # "LOW", "MEDIUM", "HIGH"
        store_id: Optional[str] = None,
        order_id: Optional[str] = None,
        conversation_id: Optional[str] = None,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None,
        action_payload: Optional[Dict[str, Any]] = None,
    ) -> AppNotification:
        """
        Creates a persistent AppNotification and broadcasts to realtime sockets.
        """
        notif_id = str(uuid.uuid4())
        payload_str = json.dumps(action_payload, ensure_ascii=False) if action_payload else None

        notif = AppNotification(
            id=notif_id,
            recipient_type=recipient_type,
            recipient_id=str(recipient_id),
            store_id=store_id,
            order_id=order_id,
            conversation_id=conversation_id,
            category=category,
            event_type=event_type,
            title=title,
            message=message,
            urgency=urgency,
            action_url=action_url,
            action_label=action_label,
            action_payload=payload_str,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notif)
        db.flush()

        # Realtime dispatch via connection manager
        try:
            broadcast_channel = f"notif_{recipient_type}_{recipient_id}"
            manager.safe_broadcast_sync(broadcast_channel, {
                "type": "NEW_NOTIFICATION",
                "notification": {
                    "id": notif.id,
                    "recipient_type": notif.recipient_type,
                    "recipient_id": notif.recipient_id,
                    "category": notif.category,
                    "event_type": notif.event_type,
                    "title": notif.title,
                    "message": notif.message,
                    "urgency": notif.urgency,
                    "action_url": notif.action_url,
                    "action_label": notif.action_label,
                    "created_at": notif.created_at.isoformat(),
                    "store_id": notif.store_id,
                }
            })
        except Exception as e:
            print("Notice: Notification realtime broadcast skipped:", e)

        return notif

    # -------------------------------------------------------------
    # TRANSACTIONAL NOTIFICATIONS
    # -------------------------------------------------------------

    @staticmethod
    def notify_order_created(db: Session, order: Order, store: Store, conversation_id: Optional[str] = None):
        """Notify store owner and customer of new order placement."""
        store_slug = store.slug or store.id if store else "shop"
        store_name = store.name if store else "La boutique"
        title = f"Nouvelle commande #{order.order_number}"
        msg = f"{order.customer_name or 'Un client'} a passé commande pour {order.total_amount:,} {order.currency}."
        
        if store:
            NotificationEngine.dispatch(
                db=db,
                recipient_type="STORE_OWNER",
                recipient_id=store.id,
                store_id=store.id,
                order_id=order.id,
                conversation_id=conversation_id,
                category="TRANSACTIONAL",
                event_type="ORDER_CREATED",
                urgency="HIGH",
                title=title,
                message=msg,
                action_url=f"/store/{store_slug}?tab=commandes&order={order.id}",
                action_label="Consulter la commande",
                action_payload={"order_number": order.order_number, "total_amount": order.total_amount}
            )

        # Notify customer that order is submitted and pending
        target_id = order.customer_id or order.customer_token
        if target_id:
            target_type = "CUSTOMER" if order.customer_id else "GUEST"
            NotificationEngine.dispatch(
                db=db,
                recipient_type=target_type,
                recipient_id=target_id,
                store_id=store.id if store else None,
                order_id=order.id,
                conversation_id=conversation_id,
                category="TRANSACTIONAL",
                event_type="ORDER_PENDING",
                urgency="HIGH",
                title=f"Commande #{order.order_number} en attente",
                message=f"Votre commande de {order.total_amount:,} {order.currency} a été transmise à {store_name}. En attente de validation par le commerçant.",
                action_url=f"/store/{store_slug}?tab=chat&conv={conversation_id}" if conversation_id else f"/store/{store_slug}?tab=commandes",
                action_label="Suivre ma commande",
                action_payload={"order_number": order.order_number, "status": "PENDING_SELLER_ACCEPTANCE"}
            )

    @staticmethod
    def notify_order_cancelled(db: Session, order: Order, store: Optional[Store], reason: str = "Annulée par le client", cancelled_by: str = "Client", conversation_id: Optional[str] = None):
        """Notify store owner and customer when an order is cancelled."""
        store_slug = store.slug or store.id if store else "shop"
        store_name = store.name if store else "La boutique"

        # 1. Notify Store Owner if cancelled
        if store:
            NotificationEngine.dispatch(
                db=db,
                recipient_type="STORE_OWNER",
                recipient_id=store.id,
                store_id=store.id,
                order_id=order.id,
                conversation_id=conversation_id,
                category="TRANSACTIONAL",
                event_type="ORDER_CANCELLED",
                urgency="HIGH",
                title=f"Commande #{order.order_number} annulée",
                message=f"La commande #{order.order_number} a été annulée ({reason}).",
                action_url=f"/store/{store_slug}?tab=commandes&order={order.id}",
                action_label="Consulter la commande",
                action_payload={"order_number": order.order_number, "reason": reason}
            )

        # 2. Notify Customer
        target_id = order.customer_id or order.customer_token
        if target_id:
            target_type = "CUSTOMER" if order.customer_id else "GUEST"
            NotificationEngine.dispatch(
                db=db,
                recipient_type=target_type,
                recipient_id=target_id,
                store_id=order.store_id,
                order_id=order.id,
                conversation_id=conversation_id,
                category="TRANSACTIONAL",
                event_type="ORDER_CANCELLED",
                urgency="MEDIUM",
                title=f"Commande #{order.order_number} annulée",
                message=f"Votre commande auprès de {store_name} a bien été annulée.",
                action_url=f"/store/{store_slug}?tab=commandes",
                action_label="Voir mes commandes",
                action_payload={"order_number": order.order_number, "reason": reason}
            )

    @staticmethod
    def notify_order_accepted(db: Session, order: Order, store: Store, conversation_id: Optional[str] = None):
        """Notify customer when merchant accepts the order."""
        if not order.customer_id and not order.customer_token:
            return
        
        target_id = order.customer_id or order.customer_token
        target_type = "CUSTOMER" if order.customer_id else "GUEST"
        store_slug = store.slug or store.id
        
        title = f"Commande #{order.order_number} acceptée !"
        msg = f"{store.name} a accepté votre commande. La préparation va commencer."

        NotificationEngine.dispatch(
            db=db,
            recipient_type=target_type,
            recipient_id=target_id,
            store_id=store.id,
            order_id=order.id,
            conversation_id=conversation_id,
            category="TRANSACTIONAL",
            event_type="ORDER_ACCEPTED",
            urgency="MEDIUM",
            title=title,
            message=msg,
            action_url=f"/store/{store_slug}?tab=chat&conv={conversation_id}" if conversation_id else f"/store/{store_slug}?tab=commandes",
            action_label="Suivre en direct",
            action_payload={"order_number": order.order_number}
        )

    @staticmethod
    def notify_order_rejected(db: Session, order: Order, store: Store, reason: str, conversation_id: Optional[str] = None):
        """Notify customer if merchant cannot fulfill the order."""
        if not order.customer_id and not order.customer_token:
            return
        
        target_id = order.customer_id or order.customer_token
        target_type = "CUSTOMER" if order.customer_id else "GUEST"
        store_slug = store.slug or store.id

        title = f"Mise à jour commande #{order.order_number}"
        msg = f"{store.name} n'a pas pu valider votre commande. Motif : {reason}"

        NotificationEngine.dispatch(
            db=db,
            recipient_type=target_type,
            recipient_id=target_id,
            store_id=store.id,
            order_id=order.id,
            conversation_id=conversation_id,
            category="TRANSACTIONAL",
            event_type="ORDER_REJECTED",
            urgency="HIGH",
            title=title,
            message=msg,
            action_url=f"/store/{store_slug}?tab=chat&conv={conversation_id}" if conversation_id else f"/store/{store_slug}",
            action_label="Échanger avec la boutique",
            action_payload={"reason": reason}
        )

    @staticmethod
    def notify_payment_proof_submitted(db: Session, order: Order, store: Store, conversation_id: Optional[str] = None):
        """Notify store owner of new payment proof screenshot."""
        store_slug = store.slug or store.id
        title = f"Reçu de paiement déposé (#{order.order_number})"
        msg = f"{order.customer_name or 'Le client'} a transmis sa preuve de paiement pour la commande #{order.order_number}."

        NotificationEngine.dispatch(
            db=db,
            recipient_type="STORE_OWNER",
            recipient_id=store.id,
            store_id=store.id,
            order_id=order.id,
            conversation_id=conversation_id,
            category="TRANSACTIONAL",
            event_type="PAYMENT_PROOF_SUBMITTED",
            urgency="HIGH",
            title=title,
            message=msg,
            action_url=f"/store/{store_slug}?tab=commandes&order={order.id}",
            action_label="Vérifier le reçu",
            action_payload={"order_number": order.order_number}
        )

    @staticmethod
    def notify_payment_verified(db: Session, order: Order, store: Store, conversation_id: Optional[str] = None):
        """Notify customer when merchant verifies payment proof."""
        if not order.customer_id and not order.customer_token:
            return
        
        target_id = order.customer_id or order.customer_token
        target_type = "CUSTOMER" if order.customer_id else "GUEST"
        store_slug = store.slug or store.id

        title = f"Paiement validé (#{order.order_number})"
        msg = f"Votre paiement a été confirmé par {store.name}. Merci pour votre confiance !"

        NotificationEngine.dispatch(
            db=db,
            recipient_type=target_type,
            recipient_id=target_id,
            store_id=store.id,
            order_id=order.id,
            conversation_id=conversation_id,
            category="TRANSACTIONAL",
            event_type="PAYMENT_VERIFIED",
            urgency="MEDIUM",
            title=title,
            message=msg,
            action_url=f"/store/{store_slug}?tab=commandes",
            action_label="Voir ma commande",
            action_payload={"order_number": order.order_number}
        )

    @staticmethod
    def notify_order_status_updated(db: Session, order: Order, store: Store, new_status: str, conversation_id: Optional[str] = None):
        """Notify customer when preparation or delivery step evolves."""
        if not order.customer_id and not order.customer_token:
            return
        
        target_id = order.customer_id or order.customer_token
        target_type = "CUSTOMER" if order.customer_id else "GUEST"
        store_slug = store.slug or store.id

        status_labels = {
            "PREPARING": "Préparation en cours de votre commande",
            "READY_FOR_DELIVERY": "Votre commande est prête",
            "OUT_FOR_DELIVERY": "Livreur en route vers votre adresse",
            "DELIVERED": "Votre commande a été livrée",
            "COMPLETED": "Commande terminée avec succès",
        }
        status_text = status_labels.get(new_status, f"Statut : {new_status}")

        NotificationEngine.dispatch(
            db=db,
            recipient_type=target_type,
            recipient_id=target_id,
            store_id=store.id,
            order_id=order.id,
            conversation_id=conversation_id,
            category="TRANSACTIONAL",
            event_type=f"ORDER_{new_status}",
            urgency="MEDIUM",
            title=f"Mise à jour : {order.order_number}",
            message=f"{status_text} chez {store.name}.",
            action_url=f"/store/{store_slug}?tab=chat&conv={conversation_id}" if conversation_id else f"/store/{store_slug}?tab=commandes",
            action_label="Suivre l'avancement",
            action_payload={"new_status": new_status, "order_number": order.order_number}
        )

    # -------------------------------------------------------------
    # STORE NEWS & FOLLOWER BROADCASTS
    # -------------------------------------------------------------

    @staticmethod
    def notify_store_announcement(db: Session, store: Store, announcement_title: str, announcement_body: str):
        """Broadcasts an announcement to all active subscribers of the store."""
        active_subs = db.query(StoreSubscription).filter(
            StoreSubscription.store_id == store.id,
            StoreSubscription.status == "ACTIVE"
        ).all()

        store_slug = store.slug or store.id

        for sub in active_subs:
            NotificationEngine.dispatch(
                db=db,
                recipient_type="CUSTOMER",
                recipient_id=sub.customer_id,
                store_id=store.id,
                category="STORE_NEWS",
                event_type="STORE_ANNOUNCEMENT",
                urgency="LOW",
                title=f"Actualité {store.name} : {announcement_title}",
                message=announcement_body,
                action_url=f"/store/{store_slug}?tab=boutique",
                action_label="Visiter la boutique",
                action_payload={"announcement_title": announcement_title}
            )

    @staticmethod
    def notify_new_follower(db: Session, store: Store, customer: Customer):
        """Notify merchant of a new follower without surveillance tone."""
        store_slug = store.slug or store.id
        NotificationEngine.dispatch(
            db=db,
            recipient_type="STORE_OWNER",
            recipient_id=store.id,
            store_id=store.id,
            category="RELATIONAL",
            event_type="NEW_FOLLOWER",
            urgency="LOW",
            title="Nouvel abonné à votre boutique",
            message=f"{customer.name or 'Un client'} s'est abonné aux nouveautés de votre boutique.",
            action_url=f"/store/{store_slug}?tab=stats",
            action_label="Voir ma communauté",
            action_payload={"customer_id": customer.id}
        )

    # -------------------------------------------------------------
    # MERCHANT DECISION SUPPORT & OPERATIONAL ASSISTANCE
    # -------------------------------------------------------------

    @staticmethod
    def get_merchant_decision_insights(db: Session, store: Store) -> List[Dict[str, Any]]:
        """
        Computes factual, contextual, non-judgmental operational cues for the merchant space.
        Strict rule: Respect store capabilities and never use surveillance phrasing.
        """
        insights = []
        now = datetime.utcnow()

        # 1. Orders awaiting seller acceptance (if CAP_ORDERING is active)
        if CapabilityService.has_capability(store, CAP_ORDERING):
            pending_orders = db.query(Order).filter(
                Order.store_id == store.id,
                Order.status == "PENDING_SELLER_ACCEPTANCE"
            ).order_by(Order.created_at.asc()).all()

            if pending_orders:
                oldest = pending_orders[0]
                minutes_waiting = int((now - oldest.created_at).total_seconds() / 60)
                
                insights.append({
                    "id": "pending_orders",
                    "type": "PENDING_ORDERS",
                    "priority": "HIGH" if minutes_waiting > 30 else "MEDIUM",
                    "title": f"{len(pending_orders)} commande{'s' if len(pending_orders) > 1 else ''} en attente d'acceptation",
                    "description": f"La commande la plus ancienne attend depuis {minutes_waiting} minute{'s' if minutes_waiting > 1 else ''}.",
                    "action_label": "Valider les commandes",
                    "action_url": f"/store/{store.slug}?tab=commandes",
                    "icon": "inventory_2",
                })

        # 2. Payment proofs waiting for validation (if CAP_PAYMENT_PROOF is active)
        if CapabilityService.has_capability(store, CAP_PAYMENT_PROOF):
            pending_proofs = db.query(PaymentProof).join(Order).filter(
                Order.store_id == store.id,
                PaymentProof.status == "PENDING_VERIFICATION"
            ).count()

            if pending_proofs > 0:
                insights.append({
                    "id": "pending_proofs",
                    "type": "PENDING_PAYMENT_PROOFS",
                    "priority": "HIGH",
                    "title": f"{pending_proofs} reçu{'s' if pending_proofs > 1 else ''} de paiement à vérifier",
                    "description": "Des clients ont transmis des captures Mobile Money en attente de confirmation.",
                    "action_label": "Vérifier les reçus",
                    "action_url": f"/store/{store.slug}?tab=commandes",
                    "icon": "receipt_long",
                })

        # 3. Community followers status
        follower_count = db.query(StoreSubscription).filter(
            StoreSubscription.store_id == store.id,
            StoreSubscription.status == "ACTIVE"
        ).count()
        if follower_count > 0:
            insights.append({
                "id": "followers_count",
                "type": "COMMUNITY_REACH",
                "priority": "LOW",
                "title": f"{follower_count} abonné{'s' if follower_count > 1 else ''} actif{'s' if follower_count > 1 else ''}",
                "description": "Vos abonnés reçoivent automatiquement vos annonces et actualités.",
                "action_label": "Publier une actualité",
                "action_url": f"/store/{store.slug}?tab=reglages",
                "icon": "loyalty",
            })

        return insights
