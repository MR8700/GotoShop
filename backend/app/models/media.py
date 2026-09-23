import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime
from app.database import Base

class Media(Base):
    __tablename__ = "media"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(100), nullable=True) # customer_id, store_id or session token
    storage_key = Column(String(255), nullable=True)
    file_url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), nullable=True)
    file_name = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, default=0) # bytes

    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True) # for audio voice notes & video

    # IMAGE, AUDIO, VIDEO, DOCUMENT
    media_type = Column(String(50), default="IMAGE", nullable=False)
    checksum = Column(String(64), nullable=True)
    is_secure_access = Column(Boolean, default=False) # True for sensitive media like payment proofs

    created_at = Column(DateTime, default=datetime.utcnow)
