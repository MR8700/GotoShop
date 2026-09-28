import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class MerchantWallet(Base):
    __tablename__ = "merchant_wallets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), unique=True, nullable=False, index=True)
    available_balance = Column(Integer, default=0) # Balance available for payout/withdrawal (in FCFA)
    pending_balance = Column(Integer, default=0)   # Escrow/Séquestre: paid online, waiting for delivery
    total_withdrawn = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)
    currency = Column(String(10), default="XOF")
    payout_phone = Column(String(50), nullable=True)
    payout_operator = Column(String(50), default="ORANGE") # ORANGE, MOOV, WAVE, LIGDICASH, BANK
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store")
    transactions = relationship("WalletTransaction", back_populates="wallet", cascade="all, delete-orphan")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id = Column(String(36), ForeignKey("merchant_wallets.id"), nullable=False, index=True)
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    order_id = Column(String(36), nullable=True, index=True)
    transaction_type = Column(String(50), nullable=False) # ESCROW_CREDIT, ESCROW_RELEASE, REFUND, WITHDRAWAL_REQUEST, WITHDRAWAL_PAID, WITHDRAWAL_CANCELLED, COMMISSION_FEE
    amount = Column(Integer, nullable=False)
    fee = Column(Integer, default=0)
    status = Column(String(50), default="COMPLETED") # PENDING, COMPLETED, REJECTED, CANCELLED
    balance_before = Column(Integer, default=0)
    balance_after = Column(Integer, default=0)
    reference = Column(String(100), unique=True, index=True, default=lambda: f"WTX-{uuid.uuid4().hex[:10].upper()}")
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    wallet = relationship("MerchantWallet", back_populates="transactions")
    store = relationship("Store")
