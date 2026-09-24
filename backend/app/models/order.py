import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Order(Base):
    __tablename__ = "orders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = Column(String(50), unique=True, nullable=False, index=True) # e.g. KSD-1045
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True, index=True)
    customer_token = Column(String(128), nullable=True, index=True) # for guest authentication/linking
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(50), nullable=True)
    customer_email = Column(String(150), nullable=True)

    # Status State Machine:
    # DRAFT, SUBMITTED, PENDING_SELLER_ACCEPTANCE, ACCEPTED, REJECTED,
    # PAYMENT_PENDING, PAYMENT_PROOF_SUBMITTED, PAYMENT_VERIFICATION, PAID,
    # PREPARING, READY_FOR_DELIVERY, OUT_FOR_DELIVERY, DELIVERED, COMPLETED, CANCELLED
    status = Column(String(50), default="PENDING_SELLER_ACCEPTANCE", nullable=False, index=True)

    # Payment Status:
    # PAYMENT_PENDING, PAYMENT_PROOF_SUBMITTED, PAYMENT_VERIFICATION_PENDING, PAYMENT_CONFIRMED, PAYMENT_REJECTED
    payment_status = Column(String(50), default="PAYMENT_PENDING", nullable=False, index=True)

    subtotal_amount = Column(Integer, default=0, nullable=False)
    delivery_fee = Column(Integer, default=500, nullable=False)
    discount_amount = Column(Integer, default=0, nullable=False)
    total_amount = Column(Integer, default=0, nullable=False)
    currency = Column(String(10), default="FCFA", nullable=False)

    notes = Column(Text, nullable=True)
    rejection_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", foreign_keys=[store_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    delivery = relationship("OrderDelivery", back_populates="order", uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="order", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=True, index=True)
    variant_id = Column(String(36), ForeignKey("product_variants.id"), nullable=True)

    product_name = Column(String(150), nullable=False)
    variant_name = Column(String(100), nullable=True)
    quantity = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), default="PIECE")
    unit_label = Column(String(50), default="pièce")
    unit_price = Column(Float, default=0.0, nullable=False)
    total_price = Column(Float, default=0.0, nullable=False)
    pricing_model = Column(String(50), default="FIXED_PER_UNIT")
    measurements = Column(Text, nullable=True) # JSON measurements e.g. {"width": 2.5, "height": 2.2}
    sales_config_snapshot = Column(Text, nullable=True) # Complete snapshot of sales rules at purchase time

    # Customization (Standard vs Customizable)
    is_customized = Column(Boolean, default=False)
    customization_text = Column(Text, nullable=True)
    customization_options = Column(Text, nullable=True) # JSON structured string

    order = relationship("Order", back_populates="items")
    product = relationship("Product", foreign_keys=[product_id])


class OrderDelivery(Base):
    __tablename__ = "order_deliveries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=False, unique=True, index=True)

    # Delivery Mode: EXACT_GPS, ADDRESS_DESCRIPTION, GPS_AND_DESCRIPTION
    delivery_mode = Column(String(50), default="GPS_AND_DESCRIPTION", nullable=False)
    delivery_city = Column(String(100), default="Kossodo (Ouagadougou)")
    delivery_address = Column(Text, nullable=True) # "Cité universitaire de Kossodo, pavillon B, chambre 12"

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy = Column(Float, nullable=True) # meters
    location_captured_at = Column(DateTime, nullable=True)

    delivery_notes = Column(Text, nullable=True)
    # PENDING, ASSIGNED, IN_TRANSIT, DELIVERED, FAILED
    delivery_status = Column(String(50), default="PENDING")
    delivery_person_id = Column(String(100), nullable=True)
    delivery_person_name = Column(String(100), nullable=True)

    estimated_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", back_populates="delivery")
