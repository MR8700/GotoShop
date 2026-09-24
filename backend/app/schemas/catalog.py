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

class SalesUnitSchema(BaseModel):
    id: str
    code: str
    name: str
    symbol: str
    measurement_type: str = "COUNT"
    precision: int = 0
    default_step: float = 1.0
    default_min: float = 1.0
    active: bool = True
    is_system: bool = True
    domain_hint: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class SalesProfileSchema(BaseModel):
    id: str
    code: str
    name: str
    domain: Optional[str] = None
    unit_code: str = "PIECE"
    unit_label: str = "pièce"
    measurement_type: str = "COUNT"
    pricing_model: str = "FIXED_PER_UNIT"
    min_quantity: float = 1.0
    max_quantity: float = 9999.0
    quantity_step: float = 1.0
    quantity_precision: int = 0
    allow_custom_measurements: bool = False
    description: Optional[str] = None

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
    stock: float = 5.0
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
    is_customizable: bool = False
    customization_prompt: Optional[str] = "Précisez vos souhaits"
    customization_options: Optional[str] = None
    display_order: int

    # Polymorphic sales attributes
    sales_unit: Optional[str] = "PIECE"
    sales_unit_label: Optional[str] = "pièce"
    measurement_type: Optional[str] = "COUNT"
    pricing_model: Optional[str] = "FIXED_PER_UNIT"
    min_quantity: Optional[float] = 1.0
    max_quantity: Optional[float] = 9999.0
    quantity_step: Optional[float] = 1.0
    quantity_precision: Optional[int] = 0
    pack_size: Optional[float] = 1.0
    allow_custom_measurements: Optional[bool] = False
    measurement_specs: Optional[str] = None

    variants: List[VariantSchema] = []
    images: List[ProductImageSchema] = []

    class Config:
        from_attributes = True

class ProductCreateSchema(BaseModel):
    store_id: Optional[str] = None
    name: str
    category_id: Optional[str] = None
    price: int
    old_price: Optional[int] = None
    stock: Optional[float] = 5.0
    description: Optional[str] = None
    short_description: Optional[str] = None
    badge_tag: Optional[str] = "Nouveau"
    image_data: Optional[str] = None # base64 data url or path
    video_data: Optional[str] = None
    pdf_data: Optional[str] = None
    is_customizable: Optional[bool] = False
    customization_prompt: Optional[str] = "Précisez vos souhaits"
    customization_options: Optional[str] = None
    sales_unit: Optional[str] = "PIECE"
    sales_unit_label: Optional[str] = "pièce"
    measurement_type: Optional[str] = "COUNT"
    pricing_model: Optional[str] = "FIXED_PER_UNIT"
    min_quantity: Optional[float] = 1.0
    max_quantity: Optional[float] = 9999.0
    quantity_step: Optional[float] = 1.0
    quantity_precision: Optional[int] = 0
    pack_size: Optional[float] = 1.0
    allow_custom_measurements: Optional[bool] = False
    measurement_specs: Optional[str] = None

class ProductUpdateSchema(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[int] = None
    old_price: Optional[int] = None
    stock: Optional[float] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    badge_tag: Optional[str] = None
    is_hero_deal: Optional[bool] = None
    is_published: Optional[bool] = None
    image_data: Optional[str] = None
    video_data: Optional[str] = None
    pdf_data: Optional[str] = None
    is_customizable: Optional[bool] = None
    customization_prompt: Optional[str] = None
    customization_options: Optional[str] = None
    sales_unit: Optional[str] = None
    sales_unit_label: Optional[str] = None
    measurement_type: Optional[str] = None
    pricing_model: Optional[str] = None
    min_quantity: Optional[float] = None
    max_quantity: Optional[float] = None
    quantity_step: Optional[float] = None
    quantity_precision: Optional[int] = None
    pack_size: Optional[float] = None
    allow_custom_measurements: Optional[bool] = None
    measurement_specs: Optional[str] = None

class CategorySchema(BaseModel):
    id: str
    store_id: str
    name: str
    slug: str
    display_order: int
    product_count: Optional[int] = 0

    class Config:
        from_attributes = True
