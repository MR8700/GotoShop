import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)

    amount = Column(Integer, nullable=False)
    currency = Column(String(10), default="FCFA", nullable=False)
    payment_method = Column(String(50), default="MOBILE_MONEY_PROOF", nullable=False)

    # PAYMENT_PENDING, PAYMENT_PROOF_SUBMITTED, PAYMENT_VERIFICATION_PENDING, PAYMENT_CONFIRMED, PAYMENT_REJECTED
    status = Column(String(50), default="PAYMENT_PENDING", nullable=False, index=True)

    transaction_reference = Column(String(100), nullable=True) # e.g. Orange Money / Wave / Moov Tx ID
    confirmed_by = Column(String(100), nullable=True) # "SELLER", "AUTOMATIC_GATEWAY"
    confirmed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="payments")
    proofs = relationship("PaymentProof", back_populates="payment", cascade="all, delete-orphan")


class PaymentProof(Base):
    __tablename__ = "payment_proofs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    payment_id = Column(String(36), ForeignKey("payments.id"), nullable=False, index=True)
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    sender_id = Column(String(100), nullable=True)
    media_id = Column(String(36), nullable=True)

    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0) # bytes
    mime_type = Column(String(100), default="image/jpeg")

    customer_note = Column(Text, nullable=True)

    # SUBMITTED, VERIFIED, REJECTED
    status = Column(String(50), default="SUBMITTED", nullable=False)
    verification_note = Column(Text, nullable=True)
    verified_by = Column(String(100), nullable=True)
    verified_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    payment = relationship("Payment", back_populates="proofs")
