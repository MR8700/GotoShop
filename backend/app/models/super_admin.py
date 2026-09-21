import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from app.database import Base

class SuperAdmin(Base):
    __tablename__ = "super_admins"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(100), default="Super Administrateur")
    password_hash = Column(String(255), nullable=False)
    password_salt = Column(String(64), nullable=False)
    session_token = Column(String(128), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
