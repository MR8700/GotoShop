import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False, index=True)
    email = Column(String(150), nullable=True)
    city = Column(String(100), default="Abidjan")
    delivery_address = Column(String(255), nullable=True)
    gps_coordinates = Column(String(100), nullable=True)
    gps_location_url = Column(String(500), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    preferred_channel = Column(String(50), default="WHATSAPP")
    notes = Column(Text, nullable=True)
    session_token = Column(String(128), nullable=True, index=True)
    
    # Moderation & Merchant Perks
    is_blocked = Column(Boolean, default=False)
    moderation_notes = Column(Text, nullable=True)
    bonus_points = Column(Integer, default=0)
    custom_discount_percent = Column(Integer, default=0)
    custom_perk_note = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store")
    order_intents = relationship("OrderIntent", back_populates="customer")
