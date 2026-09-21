from typing import List, Optional
from pydantic import BaseModel

class VariantSchema(BaseModel):
    id: str
    group_name: str
    name: str
    price_override: Optional[int] = None
    is_default: bool
    display_order: int

    class Config:
        from_attributes = True

class ProductImageSchema(BaseModel):
    id: str
    image_url: str
    alt_text: Optional[str] = None
    display_order: int

    class Config:
        from_attributes = True

class ProductSchema(BaseModel):
    id: str
    store_id: str
    category_id: Optional[str] = None
    name: str
    slug: str
    description: Optional[str] = None
    short_description: Optional[str] = None
    price: int
    old_price: Optional[int] = None
    currency: str
    stock: int
    stock_label: Optional[str] = None
    is_hero_deal: bool
    badge_tag: Optional[str] = None
    active_discussions_count: int
    views_count: int
    sales_count: int
    revenue: int
    guarantee_text: Optional[str] = None
    primary_image_url: Optional[str] = None
    video_url: Optional[str] = None
    pdf_catalog_url: Optional[str] = None
    is_published: bool
    display_order: int
    variants: List[VariantSchema] = []
    images: List[ProductImageSchema] = []

    class Config:
        from_attributes = True

class ProductCreateSchema(BaseModel):
    store_id: str
    name: str
    category_id: Optional[str] = None
    price: int
    old_price: Optional[int] = None
    stock: int = 5
    description: Optional[str] = None
    short_description: Optional[str] = None
    badge_tag: Optional[str] = "Nouveau"
    image_data: Optional[str] = None # base64 data url or path
    video_data: Optional[str] = None
    pdf_data: Optional[str] = None

class ProductUpdateSchema(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[int] = None
    old_price: Optional[int] = None
    stock: Optional[int] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    badge_tag: Optional[str] = None
    is_published: Optional[bool] = None
    image_data: Optional[str] = None
    video_data: Optional[str] = None
    pdf_data: Optional[str] = None

class CategorySchema(BaseModel):
    id: str
    store_id: str
    name: str
    slug: str
    display_order: int
    product_count: Optional[int] = 0

    class Config:
        from_attributes = True
