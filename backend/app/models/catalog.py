import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Category(Base):
    __tablename__ = "categories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, index=True)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="categories")
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    slug = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    short_description = Column(String(255), nullable=True)
    price = Column(Integer, nullable=False)
    old_price = Column(Integer, nullable=True)
    currency = Column(String(10), default="FCFA")
    stock = Column(Float, default=5.0)
    stock_label = Column(String(100), nullable=True)
    is_hero_deal = Column(Boolean, default=False, index=True)
    badge_tag = Column(String(100), nullable=True)
    active_discussions_count = Column(Integer, default=0)
    views_count = Column(Integer, default=0)
    sales_count = Column(Integer, default=0)
    revenue = Column(Integer, default=0)
    guarantee_text = Column(String(100), nullable=True)
    primary_image_url = Column(String(255), nullable=True)
    video_url = Column(String(255), nullable=True)
    pdf_catalog_url = Column(String(255), nullable=True)
    is_published = Column(Boolean, default=True, index=True)
    is_customizable = Column(Boolean, default=False)
    customization_prompt = Column(String(150), default="Précisez vos souhaits")
    customization_options = Column(Text, nullable=True) # JSON array of option groups
    display_order = Column(Integer, default=0)

    # Polymorphic Sales & Measurement Configuration
    sales_unit = Column(String(50), default="PIECE") # PIECE, PAGNE, METER, KILOGRAM, LITER, PAIR, HOUR, etc.
    sales_unit_label = Column(String(50), default="pièce") # "pièce", "pagne", "m", "kg", "paire", "h", etc.
    measurement_type = Column(String(50), default="COUNT") # COUNT, LENGTH, WEIGHT, VOLUME, TIME, AREA, CUSTOM
    pricing_model = Column(String(50), default="FIXED_PER_UNIT") # FIXED_PER_UNIT, PER_MEASUREMENT, TIERED, PACK, CUSTOM_QUOTE
    min_quantity = Column(Float, default=1.0)
    max_quantity = Column(Float, default=9999.0)
    quantity_step = Column(Float, default=1.0)
    quantity_precision = Column(Integer, default=0) # 0 for integer, 1 for 0.5, 2 for 0.01
    pack_size = Column(Float, default=1.0)
    allow_custom_measurements = Column(Boolean, default=False)
    measurement_specs = Column(Text, nullable=True) # JSON array: [{"name": "largeur", "unit": "m", "step": 0.1}]

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store", back_populates="products")
    category = relationship("Category", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    order_intents = relationship("OrderIntent", back_populates="product")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    group_name = Column(String(50), default="Coloris")
    name = Column(String(50), nullable=False)
    price_override = Column(Integer, nullable=True)
    is_default = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)

    product = relationship("Product", back_populates="variants")


class ProductImage(Base):
    __tablename__ = "product_images"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    image_url = Column(String(255), nullable=False)
    alt_text = Column(String(255), nullable=True)
    display_order = Column(Integer, default=0)

    product = relationship("Product", back_populates="images")


class SalesUnit(Base):
    __tablename__ = "sales_units"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False, index=True) # PIECE, PAGNE, METER, KILOGRAM, LITER, PAIR, HOUR, etc.
    name = Column(String(100), nullable=False) # "Pagne", "Mètre", "Kilogramme", etc.
    symbol = Column(String(50), nullable=False) # "pagne", "m", "kg", "pcs", etc.
    measurement_type = Column(String(50), default="COUNT", nullable=False) # COUNT, LENGTH, WEIGHT, VOLUME, TIME, AREA, CUSTOM
    precision = Column(Integer, default=0) # 0 for integer, 1 for 0.5, 2 for 0.01
    default_step = Column(Float, default=1.0)
    default_min = Column(Float, default=1.0)
    active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=True)
    domain_hint = Column(String(50), nullable=True) # FASHION, FOOD, ELECTRONICS, SERVICE, GENERAL_COMMERCE
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SalesProfile(Base):
    __tablename__ = "sales_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False, index=True) # e.g. "PAGNE_STANDARD", "TISSU_METRE"
    name = Column(String(100), nullable=False) # "Pagne standard (pas 0.5)"
    domain = Column(String(50), nullable=True) # FASHION, FOOD, etc.
    unit_code = Column(String(50), default="PIECE", nullable=False)
    unit_label = Column(String(50), default="pièce", nullable=False)
    measurement_type = Column(String(50), default="COUNT", nullable=False)
    pricing_model = Column(String(50), default="FIXED_PER_UNIT", nullable=False)
    min_quantity = Column(Float, default=1.0)
    max_quantity = Column(Float, default=9999.0)
    quantity_step = Column(Float, default=1.0)
    quantity_precision = Column(Integer, default=0)
    allow_custom_measurements = Column(Boolean, default=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

