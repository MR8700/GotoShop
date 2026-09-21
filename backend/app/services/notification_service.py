from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.notifications import StoreNotification
from app.models.commerce import OrderIntent
from app.schemas.notifications import NotificationResponse, NotificationListResponse

class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        store_id: str,
        notification_type: str,
        title: str,
        message: str,
        urgency: str = "MEDIUM",
        order_intent_id: str = None,
        action_type: str = None,
    ) -> StoreNotification:
        notif = StoreNotification(
            store_id=store_id,
            order_intent_id=order_intent_id,
            notification_type=notification_type,
            title=title,
            message=message,
            urgency=urgency,
            action_type=action_type,
            is_read=False,
        )
        db.add(notif)
        db.flush()
        return notif

    @staticmethod
    def get_notifications(db: Session, store_id: str, limit: int = 50) -> NotificationListResponse:
        notifs = db.query(StoreNotification).filter(
            StoreNotification.store_id == store_id
        ).order_by(
            StoreNotification.is_read.asc(),
            StoreNotification.created_at.desc()
        ).limit(limit).all()

        unread = db.query(StoreNotification).filter(
            StoreNotification.store_id == store_id,
            StoreNotification.is_read == False
        ).count()

        discrepancies = db.query(OrderIntent).filter(
            OrderIntent.store_id == store_id,
            OrderIntent.coherence_status.in_(["DISCREPANCY_CONFLICT", "DISCREPANCY_SURPRISE"])
        ).count()

        return NotificationListResponse(
            unread_count=unread,
            discrepancies_count=discrepancies,
            notifications=[NotificationResponse.model_validate(n) for n in notifs]
        )

    @staticmethod
    def mark_as_read(db: Session, notification_id: str) -> bool:
        notif = db.query(StoreNotification).filter(StoreNotification.id == notification_id).first()
        if notif:
            notif.is_read = True
            db.commit()
            return True
        return False

    @staticmethod
    def mark_all_as_read(db: Session, store_id: str) -> int:
        updated = db.query(StoreNotification).filter(
            StoreNotification.store_id == store_id,
            StoreNotification.is_read == False
        ).update({"is_read": True})
        db.commit()
        return updated
