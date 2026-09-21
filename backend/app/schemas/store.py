from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class TrustBadgeSchema(BaseModel):
    id: str
    icon_name: str
    label: str
    badge_type: str
    display_order: Optional[int] = 0

    class Config:
        from_attributes = True

class DeliveryCitySchema(BaseModel):
    id: str
    name: str
    display_label: str
    is_default: bool
    display_order: Optional[int] = 0

    class Config:
        from_attributes = True

class LoyaltyTierSchema(BaseModel):
    id: str
    name: str
    min_points: int
    badge_label: str
    perk_title: str
    perk_description: str
    discount_percent: int = 0
    is_active: bool = True
    display_order: int = 0

    class Config:
        from_attributes = True

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
    subscription_status: Optional[str] = "ACTIVE"
    subscription_plan: Optional[str] = "PRO"
    subscription_expires_at: Optional[datetime] = None
    custom_domain: Optional[str] = None
    contact_whatsapp: Optional[str] = None
    contact_email: Optional[str] = None
    trust_badges: List[TrustBadgeSchema] = []
    delivery_cities: List[DeliveryCitySchema] = []
    loyalty_tiers: List[LoyaltyTierSchema] = []

    class Config:
        from_attributes = True
