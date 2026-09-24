import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Owner(Base):
    __tablename__ = "owners"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False)
    phone_number = Column(String(30), nullable=False)
    bio = Column(Text, nullable=True)
    password_hash = Column(String(255), nullable=True)
    password_salt = Column(String(64), nullable=True)
    must_change_password = Column(Boolean, default=True)
    session_token = Column(String(128), nullable=True)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_login_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    stores = relationship("Store", back_populates="owner", cascade="all, delete-orphan")


class Store(Base):
    __tablename__ = "stores"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey("owners.id"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    tagline = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    owner_bio = Column(Text, nullable=True)
    currency = Column(String(10), default="FCFA")
    logo_url = Column(String(255), nullable=True)
    avatar_url = Column(String(255), nullable=True)
    rating = Column(Float, default=4.9)
    sales_count = Column(Integer, default=342)
    revenue = Column(Integer, default=8945000)
    is_verified = Column(Boolean, default=True)
    social_tunnel_badge = Column(String(50), default="WA/FB")
    social_tunnel_label = Column(String(100), default="Tunnel Social Actif")
    is_flash_active = Column(Boolean, default=True)
    flash_title = Column(String(100), default="Vente Flash Express")
    flash_subtitle = Column(String(200), default="Ouaga & Abidjan • Envoi sous 2h chrono")
    flash_remaining_seconds = Column(Integer, default=15502)
    voice_note_title = Column(String(150), default="Besoin d'une taille sur mesure ?")
    voice_note_subtitle = Column(String(200), default="Écouter les conseils taille & qualité")
    # Theme & Color Customization (Configurable by Store Owner)
    primary_color = Column(String(20), default="#ec761e")
    secondary_color = Column(String(20), default="#4EBE9E")
    theme_preset = Column(String(50), default="kinetic_amber")
    is_custom_theme_active = Column(Boolean, default=True)

    # Loyalty Program Settings (Configurable by Store Owner)
    is_loyalty_active = Column(Boolean, default=True)
    loyalty_spend_per_point = Column(Integer, default=1000)

    # Public Reputation & Visibility Controls (Configurable by Store Owner)
    show_ratings_publicly = Column(Boolean, default=True)
    show_sales_count_publicly = Column(Boolean, default=True)
    show_reviews_publicly = Column(Boolean, default=True)

    # Multi-Tenant & SaaS Subscription Settings
    subscription_status = Column(String(30), default="ACTIVE")  # ACTIVE, TRIAL, SUSPENDED, EXPIRED
    subscription_plan = Column(String(30), default="PRO")       # STARTER, PRO, VIP
    subscription_expires_at = Column(DateTime, nullable=True)
    custom_domain = Column(String(150), nullable=True)
    contact_whatsapp = Column(String(30), nullable=True)
    contact_email = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("Owner", back_populates="stores")
    categories = relationship("Category", back_populates="store", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    channels = relationship("StoreChannel", back_populates="store", cascade="all, delete-orphan")
    order_intents = relationship("OrderIntent", back_populates="store", cascade="all, delete-orphan")
    trust_badges = relationship("TrustBadge", back_populates="store", cascade="all, delete-orphan")
    delivery_cities = relationship("DeliveryCity", back_populates="store", cascade="all, delete-orphan")
    loyalty_tiers = relationship("LoyaltyTier", back_populates="store", cascade="all, delete-orphan", order_by="LoyaltyTier.min_points")


class TrustBadge(Base):
    __tablename__ = "trust_badges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    icon_name = Column(String(50), nullable=False)
    label = Column(String(100), nullable=False)
    badge_type = Column(String(50), default="info")
    display_order = Column(Integer, default=0)

    store = relationship("Store", back_populates="trust_badges")


class DeliveryCity(Base):
    __tablename__ = "delivery_cities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    name = Column(String(100), nullable=False)
    display_label = Column(String(100), nullable=False)
    is_default = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    store = relationship("Store", back_populates="delivery_cities")


class LoyaltyTier(Base):
    __tablename__ = "loyalty_tiers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    name = Column(String(100), nullable=False) # e.g. "Bronze", "Silver VIP", "Gold Élite"
    min_points = Column(Integer, default=0) # e.g. 0, 50, 150
    badge_label = Column(String(100), default="Niveau Membre")
    perk_title = Column(String(150), nullable=False) # e.g. "Livraison Express Prioritaire"
    perk_description = Column(Text, nullable=False) # e.g. "Traitement en tête de file pour une livraison en moins de 2h"
    discount_percent = Column(Integer, default=0) # e.g. 0, 5, 10
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="loyalty_tiers")
