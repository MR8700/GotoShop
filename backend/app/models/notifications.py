import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class StoreNotification(Base):
    __tablename__ = "store_notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    order_intent_id = Column(String(36), ForeignKey("order_intents.id"), nullable=True)
    
    # Type: CLIENT_SATISFIED, CLIENT_CANCELLED, DISCREPANCY_CONFLICT, DISCREPANCY_SURPRISE, REMINDER_24H, SYSTEM
    notification_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    urgency = Column(String(20), default="MEDIUM") # HIGH, MEDIUM, LOW
    is_read = Column(Boolean, default=False)
    action_type = Column(String(50), nullable=True) # CONFIRM_SALE, RESOLVE_DISCREPANCY, VIEW_ORDER
    
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store")
    order_intent = relationship("OrderIntent")
