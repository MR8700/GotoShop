import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class CallSession(Base):
    __tablename__ = "call_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)

    caller_type = Column(String(50), default="CUSTOMER", nullable=False) # CUSTOMER, MERCHANT
    caller_id = Column(String(100), nullable=True)
    caller_name = Column(String(100), nullable=False)

    callee_type = Column(String(50), default="MERCHANT", nullable=False) # CUSTOMER, MERCHANT
    callee_id = Column(String(100), nullable=True)
    callee_name = Column(String(100), nullable=False)

    call_type = Column(String(50), default="AUDIO", nullable=False) # AUDIO, VIDEO
    # RINGING, ACCEPTED, REJECTED, MISSED, ENDED, BUSY
    status = Column(String(50), default="RINGING", nullable=False, index=True)

    started_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="call_sessions")
