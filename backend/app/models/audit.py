import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # ORDER_CREATED, ORDER_ACCEPTED, ORDER_REJECTED,
    # PAYMENT_PROOF_SUBMITTED, PAYMENT_CONFIRMED, PAYMENT_REJECTED,
    # ORDER_STATUS_CHANGED, CALL_STARTED, CALL_ENDED
    event_name = Column(String(100), nullable=False, index=True)

    actor_type = Column(String(50), nullable=False) # CUSTOMER, MERCHANT, SYSTEM, ADMIN
    actor_id = Column(String(100), nullable=True)
    actor_name = Column(String(100), nullable=True)

    resource_type = Column(String(50), nullable=False) # ORDER, PAYMENT, CONVERSATION, CALL, MEDIA
    resource_id = Column(String(100), nullable=False, index=True)

    previous_state = Column(String(100), nullable=True)
    new_state = Column(String(100), nullable=True)
    metadata_json = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
