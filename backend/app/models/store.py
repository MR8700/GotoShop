import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Text, event
from sqlalchemy.orm import relationship
from app.database import Base
from app.core.clock import utcnow

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
    created_at = Column(DateTime, default=utcnow)

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

    # Polymorphic Architecture & Capabilities
    activity_type = Column(String(50), default="GENERAL_COMMERCE")
    capabilities = Column(Text, nullable=True)  # JSON list of active capabilities
    country = Column(String(100), default="Burkina Faso")
    city = Column(String(100), default="Ouagadougou")
    business_preferences = Column(Text, nullable=True)  # JSON configuration
    notification_profile = Column(Text, nullable=True)  # JSON configuration
    commerce_profile = Column(Text, nullable=True)      # JSON configuration
    communication_profile = Column(Text, nullable=True) # JSON configuration
    qr_code_svg = Column(Text, nullable=True)           # Cached QR Code SVG
    followers_count = Column(Integer, default=0)

    # Live presence: shop opened by its owner + heartbeat of the owner's session
    is_open = Column(Boolean, default=True)
    owner_last_seen_at = Column(DateTime, nullable=True)

    # Multi-Tenant & SaaS Subscription Settings
    subscription_status = Column(String(30), default="ACTIVE")  # ACTIVE, TRIAL, SUSPENDED, EXPIRED
    subscription_plan = Column(String(30), default="PRO")       # STARTER, PRO, VIP
    subscription_expires_at = Column(DateTime, nullable=True)
    custom_domain = Column(String(150), nullable=True)
    contact_whatsapp = Column(String(30), nullable=True)
    contact_email = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    owner = relationship("Owner", back_populates="stores")
    categories = relationship("Category", back_populates="store", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    channels = relationship("StoreChannel", back_populates="store", cascade="all, delete-orphan")
    order_intents = relationship("OrderIntent", back_populates="store", cascade="all, delete-orphan")
    trust_badges = relationship("TrustBadge", back_populates="store", cascade="all, delete-orphan")
    delivery_cities = relationship("DeliveryCity", back_populates="store", cascade="all, delete-orphan")
    delivery_spots = relationship("DeliverySpot", back_populates="store", cascade="all, delete-orphan")
    loyalty_tiers = relationship("LoyaltyTier", back_populates="store", cascade="all, delete-orphan", order_by="LoyaltyTier.min_points")
    subscriptions = relationship("StoreSubscription", back_populates="store", cascade="all, delete-orphan")
    announcements = relationship("StoreAnnouncement", back_populates="store", cascade="all, delete-orphan")


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
    # Tarif de livraison (FCFA) fixé par la boutique. NULL = non configuré (repli borné, voir order_service).
    delivery_fee = Column(Integer, nullable=True)
    # Centre GPS de la zone et rayon de couverture : servent à vérifier la position du client à la commande.
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    radius_km = Column(Float, nullable=True)
    store = relationship("Store", back_populates="delivery_cities")


@event.listens_for(DeliveryCity, "before_insert")
def _delivery_city_defaults(mapper, connection, target):
    """Toute zone créée (API, inscription, seeders) reçoit un tarif explicite et, si connu, son GPS."""
    from app.services.geo_service import DEFAULT_DELIVERY_FEE, suggest_gps
    if target.delivery_fee is None:
        target.delivery_fee = DEFAULT_DELIVERY_FEE
    if target.latitude is None or target.longitude is None:
        ref = suggest_gps(target.name)
        if ref:
            target.latitude, target.longitude = ref["latitude"], ref["longitude"]
            if target.radius_km is None:
                target.radius_km = ref["radius_km"]


class DeliverySpot(Base):
    """Lieu défini par le commerçant : point de retrait (PICKUP) ou point de livraison / rendez-vous (DELIVERY)."""
    __tablename__ = "delivery_spots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    kind = Column(String(20), default="PICKUP", nullable=False)  # PICKUP | DELIVERY
    name = Column(String(120), nullable=False)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    hours = Column(String(300), nullable=True)      # horaires libres (ex: "Lun-Sam 9h-18h")
    image_urls = Column(Text, nullable=True)        # JSON : liste d'URLs
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    delivery_fee = Column(Integer, nullable=True)   # NULL = tarif de la ville ; retrait = toujours 0
    is_active = Column(Boolean, default=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)

    store = relationship("Store", back_populates="delivery_spots")


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
    created_at = Column(DateTime, default=utcnow)

    store = relationship("Store", back_populates="loyalty_tiers")


class StoreDiscountRule(Base):
    """Remise automatique définie par le commerçant.
    audience : ALL (tous), CLIENTS (comptes clients), VISITORS (visiteurs sans compte), SELECTED (clients choisis).
    scope : STORE (toute la commande), PRODUCT (produits choisis), CATEGORY (catégories choisies).
    Une remise PRODUCT / CATEGORY ne porte que sur les lignes concernées, et seulement pour le public (audience) choisi."""
    __tablename__ = "store_discount_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    percent = Column(Integer, nullable=False)
    audience = Column(String(20), nullable=False, default="ALL")
    customer_ids = Column(Text, nullable=True)  # JSON : liste d'identifiants clients (audience SELECTED)
    scope = Column(String(20), nullable=False, default="STORE", server_default="STORE")
    product_ids = Column(Text, nullable=True)   # JSON : identifiants produits (scope PRODUCT)
    category_ids = Column(Text, nullable=True)  # JSON : identifiants catégories (scope CATEGORY)
    min_order_amount = Column(Integer, default=0)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class StoreSubscription(Base):
    """
    Represents an explicit follow/subscription relationship between a customer and a store.
    Distinct from a purchase (Achat != Abonnement).
    Statuses: ACTIVE, PAUSED, UNSUBSCRIBED, BLOCKED
    """
    __tablename__ = "store_subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    status = Column(String(30), default="ACTIVE") # ACTIVE, PAUSED, UNSUBSCRIBED, BLOCKED
    notification_preferences = Column(Text, nullable=True) # JSON: news, promos, arrivals
    subscribed_at = Column(DateTime, default=utcnow)
    unsubscribed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    store = relationship("Store", back_populates="subscriptions")
    customer = relationship("Customer")


class StoreAccessHistory(Base):
    """
    Tracks recent customer interactions (visits, views, order touchpoints)
    with a configurable TTL for recent access shortcuts.
    """
    __tablename__ = "store_access_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    customer_id = Column(String(36), nullable=True, index=True)
    guest_token = Column(String(128), nullable=True, index=True)
    interaction_type = Column(String(50), default="VISIT") # VISIT, ORDER, CHAT, QR_SCAN
    last_interacted_at = Column(DateTime, default=utcnow, index=True)

    store = relationship("Store")


class StoreAnnouncement(Base):
    """
    Public broadcast announcement/news from a store to its followers.
    """
    __tablename__ = "store_announcements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    announcement_type = Column(String(50), default="NEWS") # NEWS, PROMO, EVENT, SCHEDULE
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    store = relationship("Store", back_populates="announcements")

