import uuid
import secrets
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class FollowUpTask(Base):
    __tablename__ = "followup_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_intent_id = Column(String(36), ForeignKey("order_intents.id"), nullable=False, unique=True)
    secure_token = Column(String(64), unique=True, default=lambda: secrets.token_urlsafe(32))
    scheduled_for = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(hours=24))
    
    # Status: SCHEDULED, READY, SENT, CONFIRMED, REJECTED, EXPIRED
    status = Column(String(50), default="SCHEDULED")
    attempt_count = Column(Integer, default=0)
    sent_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order_intent = relationship("OrderIntent", back_populates="followup_task")
