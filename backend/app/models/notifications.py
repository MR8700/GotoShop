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


class AppNotification(Base):
    """
    Centralized Notification Model for both Customers and Merchants.
    Categories:
    - TRANSACTIONAL (order, payment proof, payment verification, delivery)
    - STORE_NEWS (announcement, opening, new products, promo from followed stores)
    - RELATIONAL (new follower, subscription update)
    - BUSINESS_ASSISTANCE (operational helpful cues, no surveillance)
    - OPERATIONAL (system alerts)
    """
    __tablename__ = "app_notifications"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_type = Column(String(30), nullable=False, index=True) # CUSTOMER, STORE_OWNER, ALL
    recipient_id = Column(String(100), nullable=False, index=True) # customer_id, store_id, or owner_id
    
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=True, index=True)
    order_id = Column(String(36), nullable=True, index=True)
    conversation_id = Column(String(36), nullable=True, index=True)
    
    category = Column(String(50), default="TRANSACTIONAL", index=True)
    event_type = Column(String(50), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    urgency = Column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH
    
    action_url = Column(String(255), nullable=True)
    action_label = Column(String(100), nullable=True) # "Voir dans la conversation", "Voir la commande", etc.
    action_payload = Column(Text, nullable=True) # JSON extra metadata
    
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    store = relationship("Store")

