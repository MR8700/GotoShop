import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.core.clock import utcnow

class TrackingEvent(Base):
    __tablename__ = "tracking_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    event_type = Column(String(50), nullable=False) # STORE_VIEW, PRODUCT_VIEW, ADD_CART, CHANNEL_SELECT, REDIRECT, SALE_CONFIRM, SALE_REJECT
    product_id = Column(String(36), ForeignKey("products.id"), nullable=True)
    channel_type = Column(String(50), nullable=True)
    source = Column(String(100), default="DIRECT") # TIKTOK_BIO, FB_POST, WA_STATUS, QR
    session_id = Column(String(100), nullable=True)
    ip_hash = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    share_code = Column(String(20), nullable=True, index=True)   # lien de publicité produit à l'origine de l'événement
    visitor_id = Column(String(64), nullable=True)               # visiteur anonyme (dédoublonnage)
    created_at = Column(DateTime, default=utcnow)


class TrafficSource(Base):
    __tablename__ = "traffic_sources"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    source_name = Column(String(100), nullable=False) # e.g. "TikTok Bio", "FB Post", "Statut WA", "QR Code"
    source_code = Column(String(50), nullable=False) # e.g. "tiktok_bio", "fb_post", "wa_status", "qr"
    color_hex = Column(String(20), default="#ff5733")
    visits_count = Column(Integer, default=0)
    percentage = Column(Float, default=0.0)
    display_order = Column(Integer, default=0)


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    title = Column(String(150), nullable=False) # e.g. "Lien Bio TikTok - Promo Septembre"
    target_channel = Column(String(50), default="WHATSAPP")
    source_tag = Column(String(50), nullable=False)
    short_url = Column(String(255), nullable=False)
    clicks_count = Column(Integer, default=0)
    conversions_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)


class ProductShareLink(Base):
    """Lien de publicité d'UN produit sur UN réseau (idempotent : un seul lien par produit et par réseau).
    Les vues, intentions, commandes et achats sont rattachés au `code` (voir share_ad_service)."""
    __tablename__ = "product_share_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False, index=True)
    network = Column(String(30), nullable=False)       # whatsapp, facebook, instagram, tiktok, telegram, x, snapchat, sms, email, qr, other
    code = Column(String(20), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
