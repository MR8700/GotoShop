import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Index
from app.database import Base
from app.core.clock import utcnow


class OtpCode(Base):
    """Code OTP à usage unique, stocké haché (HMAC) : survit aux redémarrages et fonctionne en multi-instances."""
    __tablename__ = "otp_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    key = Column(String(200), nullable=False, index=True)      # "<téléphone>:<contexte>"
    phone = Column(String(50), nullable=False, index=True)
    code_hash = Column(String(128), nullable=False)
    salt = Column(String(32), nullable=False)
    attempts = Column(Integer, default=0)
    amount = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow, index=True)
    expires_at = Column(DateTime, nullable=False)

    __table_args__ = (Index("ix_otp_codes_key_created", "key", "created_at"),)
