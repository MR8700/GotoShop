from typing import List, Optional, Dict, Any
from pydantic import BaseModel, computed_field, ConfigDict
from datetime import datetime, timedelta
from app.core.clock import utcnow

# The owner counts as "online" if his session pinged the server within this window.
OWNER_ONLINE_WINDOW_SECONDS = 90


def is_recently_seen(last_seen: Optional[datetime]) -> bool:
    if not last_seen:
        return False
    return utcnow() - last_seen <= timedelta(seconds=OWNER_ONLINE_WINDOW_SECONDS)

class TrustBadgeSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    icon_name: str
    label: str
    badge_type: str
    display_order: Optional[int] = 0

class DeliveryCitySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    display_label: str
    is_default: bool
    display_order: Optional[int] = 0
    delivery_fee: Optional[int] = None

class LoyaltyTierSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    min_points: int
    badge_label: str
    perk_title: str
    perk_description: str
    discount_percent: int = 0
    is_active: bool = True
    display_order: int = 0

class LoyaltyTierCreateUpdate(BaseModel):
    name: str
    min_points: int
    badge_label: Optional[str] = "Niveau Membre"
    perk_title: str
    perk_description: str
    discount_percent: Optional[int] = 0
    is_active: Optional[bool] = True
    display_order: Optional[int] = 0

class StoreUpdateSchema(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    owner_bio: Optional[str] = None
    avatar_data: Optional[str] = None # base64 data URL
    avatar_url: Optional[str] = None
    logo_data: Optional[str] = None # base64 data URL
    logo_url: Optional[str] = None
    currency: Optional[str] = None
    flash_title: Optional[str] = None
    flash_subtitle: Optional[str] = None
    flash_remaining_seconds: Optional[int] = None
    voice_note_title: Optional[str] = None
    voice_note_subtitle: Optional[str] = None
    # Theme Colors
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    theme_preset: Optional[str] = None
    is_custom_theme_active: Optional[bool] = None
    # Loyalty Settings
    is_loyalty_active: Optional[bool] = None
    loyalty_spend_per_point: Optional[int] = None
    # Public Visibility Settings
    show_ratings_publicly: Optional[bool] = None
    show_sales_count_publicly: Optional[bool] = None
    show_reviews_publicly: Optional[bool] = None

class StoreDetailSchema(BaseModel):
    id: str
    owner_id: str
    name: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    owner_bio: Optional[str] = None
    currency: str
    logo_url: Optional[str] = None
    avatar_url: Optional[str] = None
    rating: float
    sales_count: int
    revenue: int
    is_verified: bool = True
    social_tunnel_badge: Optional[str] = "Handoff Express"
    social_tunnel_label: Optional[str] = "Discussion directe préremplie"
    is_flash_active: bool = True
    flash_title: Optional[str] = "Vente Flash Express"
    flash_subtitle: Optional[str] = "Ouaga & Abidjan • Envoi sous 2h chrono"
    flash_remaining_seconds: Optional[int] = 15450
    voice_note_title: Optional[str] = "Message vocal d'Awa"
    voice_note_subtitle: Optional[str] = "Écouter les conseils taille & qualité"
    primary_color: Optional[str] = "#ec761e"
    secondary_color: Optional[str] = "#4EBE9E"
    theme_preset: Optional[str] = "kinetic_amber"
    is_custom_theme_active: Optional[bool] = True
    is_loyalty_active: Optional[bool] = True
    loyalty_spend_per_point: Optional[int] = 1000
    show_ratings_publicly: Optional[bool] = True
    show_sales_count_publicly: Optional[bool] = True
    show_reviews_publicly: Optional[bool] = True
    subscription_status: Optional[str] = "ACTIVE"
    subscription_plan: Optional[str] = "PRO"
    subscription_expires_at: Optional[datetime] = None
    custom_domain: Optional[str] = None
    contact_whatsapp: Optional[str] = None
    contact_email: Optional[str] = None
    trust_badges: List[TrustBadgeSchema] = []
    delivery_cities: List[DeliveryCitySchema] = []
    loyalty_tiers: List[LoyaltyTierSchema] = []
    city: Optional[str] = None
    country: Optional[str] = None
    is_open: Optional[bool] = True
    owner_last_seen_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @computed_field
    @property
    def is_owner_online(self) -> bool:
        return is_recently_seen(self.owner_last_seen_at)

    model_config = ConfigDict(from_attributes=True)

class StoreRegisterRequest(BaseModel):
    store_name: str
    owner_name: str
    owner_phone: str
    owner_email: Optional[str] = None
    password: Optional[str] = None
    country: Optional[str] = "Burkina Faso"
    city: Optional[str] = "Ouagadougou"
    locality: Optional[str] = None
    category_name: Optional[str] = "Mode & Accessoires"
    tagline: Optional[str] = None
    logo_data: Optional[str] = None
    logo_url: Optional[str] = None
    plan_code: Optional[str] = "STARTER"
    operator_code: Optional[str] = "ORANGE"
    payment_method: Optional[str] = "OTP" # "OTP" or "CAPTURE"
    otp_code: Optional[str] = None
    transaction_reference: Optional[str] = None
    payment_proof_data: Optional[str] = None
    notes: Optional[str] = None

class StoreOwnerBriefSchema(BaseModel):
    id: str
    full_name: str
    email: str
    phone_number: str

class StoreRegisterResponse(BaseModel):
    success: bool
    message: str
    store_id: str
    store_name: str
    slug: str
    store_url: str
    access_token: str
    owner: StoreOwnerBriefSchema
    temporary_password: Optional[str] = None
    must_change_password: bool = False
    subscription_status: str = "TRIAL"
    trial_days: int = 14
    store_ids: List[str] = []
    store_slugs: List[str] = []
    owned_stores: List[Dict[str, Any]] = []
