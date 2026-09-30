from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CustomerQuickRegisterRequest(BaseModel):
    name: str
    phone: str
    city: Optional[str] = "Abidjan"
    store_id: Optional[str] = None
    otp_code: Optional[str] = None

class CustomerQuickLoginRequest(BaseModel):
    phone: str
    store_id: Optional[str] = None
    otp_code: Optional[str] = None

class CustomerLoginOtpRequest(BaseModel):
    phone: str
    store_id: Optional[str] = None

class CustomerProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    delivery_address: Optional[str] = None
    gps_coordinates: Optional[str] = None
    gps_location_url: Optional[str] = None
    preferred_channel: Optional[str] = None
    notes: Optional[str] = None
    avatar_data: Optional[str] = None # Base64 encoded image

class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    store_id: str
    name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = "Abidjan"
    delivery_address: Optional[str] = None
    gps_coordinates: Optional[str] = None
    gps_location_url: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_channel: str = "WHATSAPP"
    notes: Optional[str] = None
    created_at: datetime

class CustomerAuthResponse(BaseModel):
    access_token: Optional[str] = None  # None quand la session vit uniquement dans le cookie HttpOnly
    token_type: str = "bearer"
    customer: CustomerResponse
    message: str

class CustomerOrderItem(BaseModel):
    id: str
    reference_code: str
    product_name: str
    product_image_url: Optional[str] = None
    quantity: int
    selected_color: Optional[str] = None
    delivery_city: Optional[str] = None
    fulfillment_type: Optional[str] = None
    spot_name: Optional[str] = None
    spot_hours: Optional[str] = None
    total_amount: int
    currency: str = "FCFA"
    status: str
    client_status: Optional[str] = "PENDING"
    client_feedback: Optional[str] = None
    client_satisfaction_rating: Optional[int] = None
    client_action_at: Optional[datetime] = None
    coherence_status: Optional[str] = "HARMONIZED_PENDING"
    coherence_notes: Optional[str] = None
    is_sold: Optional[bool] = None
    channel_type: str
    redirect_url: str
    customer_location_url: Optional[str] = None
    customer_coordinates: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    conversation_id: Optional[str] = None
    is_client_archived: Optional[bool] = False
    is_client_hidden: Optional[bool] = False
    created_at: datetime

class CustomerStatsResponse(BaseModel):
    total_orders: int
    confirmed_orders: int
    satisfied_orders: int = 0
    cancelled_orders: int = 0
    total_spent: int
    loyalty_points: float
    loyalty_tier: str # "Bronze", "Silver", "Gold VIP"
    next_tier: Optional[str] = None
    next_tier_progress: int = 0 # Percentage 0-100
    savings_amount: int
    favorite_channel: str
    member_since: datetime
    currency: str = "FCFA"
    is_loyalty_active: bool = True
    loyalty_spend_per_point: int = 1000
    all_tiers: List[dict] = []

class MerchantClientItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    city: Optional[str] = "Abidjan"
    delivery_address: Optional[str] = None
    gps_location_url: Optional[str] = None
    avatar_url: Optional[str] = None
    is_blocked: bool = False
    moderation_notes: Optional[str] = None
    bonus_points: float = 0
    custom_discount_percent: int = 0
    custom_perk_note: Optional[str] = None
    total_orders_count: int = 0
    confirmed_sales_count: int = 0
    cancelled_count: int = 0
    total_spent: int = 0
    currency: str = "FCFA"
    loyalty_points: float = 0
    loyalty_tier: str = "Membre"
    average_satisfaction: Optional[float] = None
    last_interaction_at: Optional[datetime] = None
    created_at: datetime

class MerchantClientDetail(MerchantClientItem):
    orders: List[CustomerOrderItem] = []

class ModerateClientRequest(BaseModel):
    is_blocked: Optional[bool] = None
    moderation_notes: Optional[str] = None

class GrantClientPerkRequest(BaseModel):
    bonus_points: Optional[float] = 0
    custom_discount_percent: Optional[int] = 0
    custom_perk_note: Optional[str] = None

