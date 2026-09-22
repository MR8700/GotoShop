import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False) # e.g. "Formule Starter", "Formule Pro", "Formule VIP"
    code = Column(String(50), unique=True, nullable=False) # STARTER, PRO, VIP
    price = Column(Integer, nullable=False, default=1000) # 1000 FCFA
    currency = Column(String(10), default="FCFA")
    duration_days = Column(Integer, default=30)
    description = Column(Text, nullable=True)
    features = Column(Text, nullable=True) # JSON array string of features
    badge_label = Column(String(100), nullable=True) # e.g. "Idéal Débutant", "Le Plus Populaire"
    is_popular = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PaymentUssdConfig(Base):
    __tablename__ = "payment_ussd_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    operator_name = Column(String(50), nullable=False) # e.g. "Orange Money", "Moov Money"
    operator_code = Column(String(30), unique=True, nullable=False) # ORANGE, MOOV, WAVE, MTN
    merchant_number = Column(String(50), nullable=False) # e.g. "65711741", "52045008"
    ussd_template = Column(String(120), nullable=False) # e.g. "*144*2*1*{merchant}*{amount}#" or "*555*2*1*{merchant}*{amount}#"
    instructions = Column(Text, nullable=True)
    brand_color = Column(String(20), default="#FF7900")
    text_color = Column(String(20), default="#FFFFFF")
    icon_type = Column(String(50), default="orange")
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SubscriptionRequest(Base):
    __tablename__ = "subscription_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_type = Column(String(30), default="NEW_STORE") # NEW_STORE, RENEWAL, UPGRADE
    store_id = Column(String(36), nullable=True) # if renewal or upgrade
    store_name = Column(String(100), nullable=False)
    owner_name = Column(String(100), nullable=False)
    owner_email = Column(String(100), nullable=False)
    owner_phone = Column(String(50), nullable=False) # WhatsApp number
    plan_id = Column(String(36), nullable=True)
    plan_code = Column(String(50), nullable=False) # STARTER, PRO, VIP
    plan_name = Column(String(100), nullable=False)
    amount = Column(Integer, nullable=False, default=1000)
    currency = Column(String(10), default="FCFA")
    duration_days = Column(Integer, default=30)
    operator_code = Column(String(30), nullable=False) # ORANGE, MOOV, etc.
    ussd_code_used = Column(String(120), nullable=True) # The exact USSD dial string shown
    payment_proof_url = Column(Text, nullable=True) # Path or base64
    status = Column(String(30), default="PENDING") # PENDING, APPROVED, REJECTED
    rejection_reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    generated_password = Column(String(100), nullable=True) # Saved upon approval for merchant handover
    created_store_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
