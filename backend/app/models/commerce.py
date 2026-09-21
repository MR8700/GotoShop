import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class OrderIntent(Base):
    __tablename__ = "order_intents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    reference_code = Column(String(50), unique=True, nullable=False, index=True) # CMD-8F29A1
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    channel_id = Column(String(36), ForeignKey("store_channels.id"), nullable=True)
    channel_type = Column(String(50), default="WHATSAPP") # WHATSAPP, MESSENGER, TIKTOK, CALL
    
    # Customer Details (optional, no login required)
    customer_name = Column(String(100), nullable=True) # e.g. "Amadou K."
    customer_phone = Column(String(50), nullable=True) # e.g. "+225 07 48 ••"
    customer_source = Column(String(100), default="DIRECT") # TIKTOK, INSTAGRAM, FACEBOOK, WHATSAPP, QR
    customer_location_url = Column(String(500), nullable=True) # https://maps.google.com/?q=5.3599,3.9920
    customer_coordinates = Column(String(100), nullable=True) # "5.3599, -3.9920"
    
    # Customer Reference (linked if customer is identified)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True, index=True)

    # Order Specifics
    quantity = Column(Integer, default=1)
    selected_color = Column(String(50), nullable=True) # "Bleu Nuit"
    delivery_city = Column(String(100), nullable=True) # "Cocody (Abidjan)"
    unit_price = Column(Integer, nullable=False)
    total_amount = Column(Integer, nullable=False)
    currency = Column(String(10), default="FCFA")
    
    # Status: CREATED, REDIRECTED, PENDING_24H, SOLD, NOT_SOLD, CANCELLED
    status = Column(String(50), default="CREATED", index=True)
    is_urgent_followup = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    
    # Client Feedback & Satisfaction: PENDING, SATISFIED, CANCELLED
    client_status = Column(String(50), default="PENDING", index=True)
    client_feedback = Column(String(255), nullable=True)
    client_satisfaction_rating = Column(Integer, nullable=True) # 1-5 stars
    client_action_at = Column(DateTime, nullable=True)

    # Arbitration & Coherence Engine
    coherence_status = Column(String(50), default="HARMONIZED_PENDING", index=True)
    coherence_notes = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    redirected_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="order_intents")
    product = relationship("Product", back_populates="order_intents")
    channel = relationship("StoreChannel", back_populates="order_intents")
    customer = relationship("Customer", back_populates="order_intents")
    followup_task = relationship("FollowUpTask", back_populates="order_intent", uselist=False, cascade="all, delete-orphan")
    sale_confirmation = relationship("SaleConfirmation", back_populates="order_intent", uselist=False, cascade="all, delete-orphan")


class SaleConfirmation(Base):
    __tablename__ = "sale_confirmations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_intent_id = Column(String(36), ForeignKey("order_intents.id"), nullable=False, unique=True)
    is_sold = Column(Boolean, nullable=False) # True = OUI, False = NON
    reason = Column(String(255), nullable=True) # e.g. "Report", "Désistement client", "Prix"
    amount_paid = Column(Integer, nullable=True)
    confirmed_by = Column(String(100), default="OWNER")
    confirmed_at = Column(DateTime, default=datetime.utcnow)

    order_intent = relationship("OrderIntent", back_populates="sale_confirmation")
