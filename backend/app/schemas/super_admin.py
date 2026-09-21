from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class SuperAdminLoginRequest(BaseModel):
    email: str
    password: str

class SuperAdminInfo(BaseModel):
    id: str
    email: str
    full_name: str

class SuperAdminLoginResponse(BaseModel):
    success: bool
    session_token: str
    admin: SuperAdminInfo

class SuperAdminStoreCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    tagline: Optional[str] = None
    owner_name: str
    owner_email: str
    owner_phone: str
    password: Optional[str] = "Marchand2026!"
    currency: Optional[str] = "FCFA"
    primary_color: Optional[str] = "#ec761e"
    theme_preset: Optional[str] = "kinetic_amber"
    subscription_plan: Optional[str] = "PRO"
    trial_days: Optional[int] = 30
    delivery_city: Optional[str] = "Abidjan (Cocody)"

class SuperAdminStoreStatusRequest(BaseModel):
    subscription_status: str # ACTIVE, TRIAL, SUSPENDED, EXPIRED
    subscription_plan: Optional[str] = None
    extend_days: Optional[int] = None

class SuperAdminStoreItem(BaseModel):
    id: str
    name: str
    slug: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    avatar_url: Optional[str] = None
    currency: str = "FCFA"
    primary_color: Optional[str] = "#ec761e"
    theme_preset: Optional[str] = "kinetic_amber"
    rating: float = 5.0
    owner_id: str
    owner_name: str
    owner_email: str
    owner_phone: str
    subscription_status: str = "ACTIVE"
    subscription_plan: str = "PRO"
    subscription_expires_at: Optional[datetime] = None
    custom_domain: Optional[str] = None
    products_count: int = 0
    orders_count: int = 0
    total_revenue: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

class SuperAdminOverview(BaseModel):
    total_stores_count: int
    active_stores_count: int
    trial_stores_count: int
    suspended_stores_count: int
    total_orders_network: int
    total_gmv_network: int
    total_products_network: int
    recent_stores: List[SuperAdminStoreItem] = []
