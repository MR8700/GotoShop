from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class NotificationResponse(BaseModel):
    id: str
    store_id: str
    order_intent_id: Optional[str] = None
    notification_type: str
    title: str
    message: str
    urgency: str
    is_read: bool
    action_type: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    unread_count: int
    discrepancies_count: int
    notifications: list[NotificationResponse]
