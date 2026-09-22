from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SubscriptionPlanSchema(BaseModel):
    id: str
    name: str
    code: str
    price: int
    currency: str = "FCFA"
    duration_days: int = 30
    description: Optional[str] = None
    features: Optional[str] = None
    badge_label: Optional[str] = None
    is_popular: bool = False
    is_active: bool = True
    display_order: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubscriptionPlanCreateSchema(BaseModel):
    name: str
    code: str
    price: int
    currency: str = "FCFA"
    duration_days: int = 30
    description: Optional[str] = None
    features: Optional[str] = None
    badge_label: Optional[str] = None
    is_popular: bool = False
    display_order: int = 0


class SubscriptionPlanUpdateSchema(BaseModel):
    name: Optional[str] = None
    price: Optional[int] = None
    duration_days: Optional[int] = None
    description: Optional[str] = None
    features: Optional[str] = None
    badge_label: Optional[str] = None
    is_popular: Optional[bool] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class PaymentUssdConfigSchema(BaseModel):
    id: str
    operator_name: str
    operator_code: str
    merchant_number: str
    ussd_template: str
    instructions: Optional[str] = None
    brand_color: str = "#FF7900"
    text_color: str = "#FFFFFF"
    icon_type: str = "orange"
    is_active: bool = True
    display_order: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentUssdConfigUpdateSchema(BaseModel):
    operator_name: Optional[str] = None
    merchant_number: Optional[str] = None
    ussd_template: Optional[str] = None
    instructions: Optional[str] = None
    brand_color: Optional[str] = None
    text_color: Optional[str] = None
    icon_type: Optional[str] = None
    is_active: Optional[bool] = None


class UssdDialOptionSchema(BaseModel):
    operator_code: str
    operator_name: str
    brand_color: str
    text_color: str
    icon_type: str
    merchant_number: str
    ussd_code: str
    tel_link: str
    instructions: str


class PublicPlanWithUssdSchema(BaseModel):
    plan: SubscriptionPlanSchema
    payment_options: List[UssdDialOptionSchema]


class SubscriptionPublicInfoResponse(BaseModel):
    plans: List[SubscriptionPlanSchema]
    ussd_configs: List[PaymentUssdConfigSchema]
    plans_with_ussd: List[PublicPlanWithUssdSchema]


class SubscriptionRequestSubmitSchema(BaseModel):
    request_type: str = "NEW_STORE"  # NEW_STORE, RENEWAL, UPGRADE
    store_id: Optional[str] = None
    store_name: str
    owner_name: str
    owner_email: str
    owner_phone: str  # WhatsApp
    plan_code: str  # STARTER, PRO, VIP
    operator_code: str  # ORANGE, MOOV, etc.
    payment_proof_data: Optional[str] = None  # base64 data URI
    notes: Optional[str] = None


class SubscriptionRequestReviewSchema(BaseModel):
    status: str  # APPROVED, REJECTED
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionRequestItemSchema(BaseModel):
    id: str
    request_type: str
    store_id: Optional[str] = None
    store_name: str
    owner_name: str
    owner_email: str
    owner_phone: str
    plan_id: Optional[str] = None
    plan_code: str
    plan_name: str
    amount: int
    currency: str
    duration_days: int
    operator_code: str
    ussd_code_used: Optional[str] = None
    payment_proof_url: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None
    generated_password: Optional[str] = None
    created_store_id: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        from_attributes = True
