import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.core.clock import utcnow

class LoyaltyLedgerEntry(Base):
    __tablename__ = "loyalty_points_ledger"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    order_id = Column(String(36), nullable=True, index=True)
    entry_type = Column(String(50), nullable=False)  # EARNED_ORDER, REDEEMED_DISCOUNT, MANUAL_ADJUSTMENT, BONUS_TIER, EXPIRED
    points = Column(Integer, nullable=False)          # Positive for credit, negative for debit
    balance_after = Column(Integer, nullable=False)
    description = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=True)     # Rolling expiry for positive point additions
    is_expired = Column(Boolean, default=False)
    # Lots FIFO : pour une entrée positive, points encore utilisables (ni dépensés, ni expirés).
    # NULL pour les débits / expirations (ce ne sont pas des lots).
    points_remaining = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)

    store = relationship("Store")
    customer = relationship("Customer")


class LoyaltyRewardCoupon(Base):
    __tablename__ = "loyalty_reward_coupons"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True, index=True)
    code = Column(String(50), nullable=False, index=True)
    title = Column(String(100), nullable=False)
    discount_percent = Column(Integer, default=0)
    discount_amount = Column(Integer, default=0)
    min_order_amount = Column(Integer, default=0)
    is_used = Column(Boolean, default=False)
    used_at = Column(DateTime, nullable=True)
    order_id = Column(String(36), nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    store = relationship("Store")
    customer = relationship("Customer")
