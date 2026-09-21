from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class CreateIntentRequest(BaseModel):
    store_id: str
    product_id: str
    channel_type: str = "WHATSAPP"
    quantity: int = 1
    selected_color: Optional[str] = None
    delivery_city: Optional[str] = None
    customer_source: Optional[str] = "DIRECT"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_location_url: Optional[str] = None
    customer_coordinates: Optional[str] = None
    customer_id: Optional[str] = None

class IntentResponse(BaseModel):
    id: str
    reference_code: str
    store_id: str
    product_id: str
    channel_type: str
    quantity: int
    selected_color: Optional[str] = None
    delivery_city: Optional[str] = None
    customer_location_url: Optional[str] = None
    customer_coordinates: Optional[str] = None
    unit_price: int
    total_amount: int
    currency: str
    status: str
    client_status: Optional[str] = "PENDING"
    client_feedback: Optional[str] = None
    client_satisfaction_rating: Optional[int] = None
    client_action_at: Optional[datetime] = None
    coherence_status: Optional[str] = "HARMONIZED_PENDING"
    coherence_notes: Optional[str] = None
    is_archived: bool = False
    redirect_url: str
    prefilled_message: str
    secure_token: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ConfirmSaleRequest(BaseModel):
    is_sold: bool
    reason: Optional[str] = None
    amount_paid: Optional[int] = None

class ClientOrderActionRequest(BaseModel):
    action: str # "SATISFY" or "CANCEL"
    reason: Optional[str] = None # e.g. "Changement d'avis", "Super qualité", etc.
    rating: Optional[int] = 5 # 1 to 5 stars

class ResolveDiscrepancyRequest(BaseModel):
    resolution: str # "ACCEPT_CANCELLATION" or "FORCE_CONFIRM_SALE"
    notes: Optional[str] = None

class IntentSummarySchema(BaseModel):
    id: str
    reference_code: str
    product_name: str
    product_image_url: Optional[str] = None
    channel_type: str
    total_amount: int
    currency: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_source: Optional[str] = None
    customer_location_url: Optional[str] = None
    customer_coordinates: Optional[str] = None
    quantity: int
    selected_color: Optional[str] = None
    delivery_city: Optional[str] = None
    status: str
    client_status: Optional[str] = "PENDING"
    client_feedback: Optional[str] = None
    client_satisfaction_rating: Optional[int] = None
    client_action_at: Optional[datetime] = None
    coherence_status: Optional[str] = "HARMONIZED_PENDING"
    coherence_notes: Optional[str] = None
    is_urgent_followup: bool
    is_archived: bool = False
    time_elapsed_display: str
    created_at: datetime

    class Config:
        from_attributes = True
