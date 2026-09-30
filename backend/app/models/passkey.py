"""Authentification sans mot de passe : Passkeys (WebAuthn), codes de récupération, défis, journal de sécurité.

Aucune donnée biométrique ni clé privée n'est jamais stockée : seule la clé PUBLIQUE de la Passkey l'est.
"""
import uuid
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, ForeignKey, LargeBinary, Index
from app.database import Base
from app.core.clock import utcnow


class PasskeyCredential(Base):
    __tablename__ = "passkey_credentials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    credential_id = Column(String(512), nullable=False, unique=True, index=True)  # base64url
    public_key = Column(LargeBinary, nullable=False)                               # clé publique COSE
    sign_count = Column(Integer, default=0)
    device_type = Column(String(50), nullable=True)   # single_device | multi_device
    backed_up = Column(Boolean, default=False)
    transports = Column(String(200), nullable=True)   # JSON list
    friendly_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    last_used_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)


class RecoveryCode(Base):
    __tablename__ = "recovery_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), ForeignKey("customers.id"), nullable=False, index=True)
    code_hash = Column(String(128), nullable=False, index=True)  # HMAC-SHA256, jamais le code en clair
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    revoked_at = Column(DateTime, nullable=True)


class AuthChallenge(Base):
    """Défi WebAuthn (type register/login) ou jeton de session de récupération limitée (type recovery)."""
    __tablename__ = "auth_challenges"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), nullable=True, index=True)
    challenge = Column(String(255), nullable=False, index=True)  # défi base64url, ou hash du jeton de récupération
    type = Column(String(20), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)


class SecurityEvent(Base):
    __tablename__ = "security_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String(36), nullable=True, index=True)
    event_type = Column(String(60), nullable=False, index=True)
    credential_id = Column(String(512), nullable=True)
    ip_hash = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)
    event_metadata = Column("metadata", Text, nullable=True)


class PasswordResetOtp(Base):
    """OTP de réinitialisation du mot de passe de sécurité (commerçant), envoyé par WhatsApp. Jamais en clair."""
    __tablename__ = "password_reset_otps"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey("owners.id"), nullable=False, index=True)
    code_hash = Column(String(128), nullable=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
