import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False, index=True)
    order_id = Column(String(36), ForeignKey("orders.id"), nullable=True, index=True)

    # Context: ORDER, GENERAL_STORE, SUPPORT
    context_type = Column(String(50), default="GENERAL_STORE", nullable=False, index=True)
    title = Column(String(200), nullable=True) # e.g. "Commande #KSD-1045" or "Garbadrome Kossodo"

    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=True, index=True)
    customer_token = Column(String(128), nullable=True, index=True) # for guest users
    customer_name = Column(String(100), nullable=True)
    customer_avatar_url = Column(String(255), nullable=True)

    last_message_at = Column(DateTime, default=datetime.utcnow, index=True)
    last_message_preview = Column(String(255), nullable=True)
    is_archived = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store", foreign_keys=[store_id])
    order = relationship("Order", back_populates="conversations", foreign_keys=[order_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    call_sessions = relationship("CallSession", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)

    # CUSTOMER, MERCHANT, ADMIN, DELIVERY
    user_type = Column(String(50), default="CUSTOMER", nullable=False)
    user_id = Column(String(100), nullable=True) # customer_id, owner_id or session token
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(255), nullable=True)

    last_read_at = Column(DateTime, nullable=True)
    unread_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    conversation = relationship("Conversation", back_populates="participants")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False, index=True)

    # CUSTOMER, MERCHANT, SYSTEM
    sender_type = Column(String(50), default="CUSTOMER", nullable=False)
    sender_id = Column(String(100), nullable=True)
    sender_name = Column(String(100), nullable=False)

    # Message types:
    # TEXT, IMAGE, VIDEO, AUDIO, FILE, LOCATION, ORDER, PAYMENT_PROOF, SYSTEM, CALL_EVENT
    message_type = Column(String(50), default="TEXT", nullable=False)
    content = Column(Text, nullable=False)

    # Structured metadata (JSON string):
    # - For ORDER: { order_id, order_number, total_amount, items, status, payment_status }
    # - For PAYMENT_PROOF: { proof_id, file_url, amount, status, mime_type, file_size }
    # - For LOCATION: { latitude, longitude, accuracy, address, maps_url }
    # - For AUDIO: { duration_seconds, waveform, mime_type }
    # - For CALL_EVENT: { call_id, call_type, status, duration_seconds }
    metadata_json = Column(Text, nullable=True)

    # Status: LOCAL, UPLOADING, SENT, DELIVERED, READ, FAILED
    status = Column(String(50), default="SENT", nullable=False)
    reply_to_id = Column(String(36), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="messages")
    attachments = relationship("MessageAttachment", back_populates="message", cascade="all, delete-orphan")


class MessageAttachment(Base):
    __tablename__ = "message_attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String(36), ForeignKey("chat_messages.id"), nullable=False, index=True)
    media_id = Column(String(36), ForeignKey("media.id"), nullable=True)

    file_url = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, default=0)
    thumbnail_url = Column(String(500), nullable=True)
    duration_seconds = Column(Float, nullable=True)

    message = relationship("ChatMessage", back_populates="attachments")
