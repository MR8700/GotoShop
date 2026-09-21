from typing import Optional
from pydantic import BaseModel

class ChannelSchema(BaseModel):
    id: str
    store_id: str
    channel_type: str
    display_title: str
    badge_text: Optional[str] = None
    badge_style: Optional[str] = None
    account_handle: str
    subtitle: Optional[str] = None
    icon_name: str
    theme_color: str
    is_active: bool
    is_recommended: bool
    display_order: int

    class Config:
        from_attributes = True

class ChannelUpdateSchema(BaseModel):
    is_active: Optional[bool] = None
    account_handle: Optional[str] = None
    display_title: Optional[str] = None
    subtitle: Optional[str] = None
    is_recommended: Optional[bool] = None
