"""Service central d'authentification sans mot de passe (Passkeys WebAuthn + codes de récupération).

Principes : GotoShop ne reçoit que des preuves cryptographiques WebAuthn (jamais biométrie/PIN/clé privée) ;
les défis sont à usage unique et expirent vite ; les codes de récupération sont stockés hachés (HMAC).
"""
import hashlib
import hmac
import json
import secrets
from datetime import timedelta
from typing import Optional, Tuple, List, Dict, Any
from urllib.parse import urlparse

from sqlalchemy import update
from sqlalchemy.orm import Session
try:
    from webauthn import (
        generate_registration_options, verify_registration_response,
        generate_authentication_options, verify_authentication_response, options_to_json,
    )
    from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria, ResidentKeyRequirement, UserVerificationRequirement,
        PublicKeyCredentialDescriptor,
    )
    WEBAUTHN_AVAILABLE = True
except ImportError:
    WEBAUTHN_AVAILABLE = False
    generate_registration_options = None
    verify_registration_response = None
    generate_authentication_options = None
    verify_authentication_response = None
    options_to_json = None
    base64url_to_bytes = None
    bytes_to_base64url = None
    AuthenticatorSelectionCriteria = None
    ResidentKeyRequirement = None
    UserVerificationRequirement = None
    PublicKeyCredentialDescriptor = None

from app.config import settings
from app.core.clock import utcnow
from app.models.customer import Customer
from app.models.passkey import PasskeyCredential, RecoveryCode, AuthChallenge, SecurityEvent

RECOVERY_CODE_COUNT = 10
RECOVERY_SESSION_MINUTES = 10
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sans 0/O/1/I : lisible à la main
MAX_RECOVERY_FAILURES = 8          # par téléphone, sur 15 minutes
MAX_ACTIVE_PASSKEYS = 10


class PasskeyError(ValueError):
    pass


def _pepper() -> bytes:
    return (settings.OTP_SECRET or "gotoshop").encode()


def _rp_id() -> str:
    if settings.PASSKEY_RP_ID:
        return settings.PASSKEY_RP_ID
    return urlparse(settings.FRONTEND_URL).hostname or "localhost"


def _origins() -> List[str]:
    raw = [o.strip() for o in settings.PASSKEY_ORIGINS.split(",") if o.strip()]
    return raw or [settings.FRONTEND_URL.rstrip("/")]


def _hash_recovery_code(code: str) -> str:
    norm = "".join(ch for ch in (code or "").upper() if ch.isalnum())
    return hmac.new(_pepper(), norm.encode(), hashlib.sha256).hexdigest()


class PasskeyService:
    # ------------------------------------------------------------------ journal
    @staticmethod
    def log_event(db: Session, event_type: str, customer_id: Optional[str] = None, credential_id: Optional[str] = None,
                  ip: Optional[str] = None, user_agent: Optional[str] = None, **meta) -> None:
        ip_hash = hmac.new(_pepper(), ip.encode(), hashlib.sha256).hexdigest()[:32] if ip else None
        db.add(SecurityEvent(customer_id=customer_id, event_type=event_type, credential_id=credential_id,
                             ip_hash=ip_hash, user_agent=(user_agent or "")[:255] or None,
                             event_metadata=json.dumps(meta) if meta else None))
        db.commit()

    # ------------------------------------------------------------------ défis
    @classmethod
    def _new_challenge(cls, db: Session, ctype: str, customer_id: Optional[str]) -> Tuple[AuthChallenge, bytes]:
        raw = secrets.token_bytes(32)
        row = AuthChallenge(customer_id=customer_id, challenge=bytes_to_base64url(raw), type=ctype,
                            expires_at=utcnow() + timedelta(seconds=settings.PASSKEY_CHALLENGE_TTL_SECONDS))
        db.add(row)
        db.commit()
        return row, raw

    @classmethod
    def _consume_challenge(cls, db: Session, challenge_id: str, ctype: str, customer_id: Optional[str]) -> bytes:
        """Consomme atomiquement le défi (anti-rejeu) ; échoue s'il est inconnu, expiré, déjà utilisé ou d'un autre type."""
        row = db.query(AuthChallenge).filter(AuthChallenge.id == challenge_id).first()
        if not row or row.type != ctype or (customer_id and row.customer_id != customer_id) or row.expires_at < utcnow():
            raise PasskeyError("Défi invalide ou expiré. Recommencez.")
        res = db.execute(update(AuthChallenge).where(AuthChallenge.id == challenge_id, AuthChallenge.consumed_at.is_(None))
                         .values(consumed_at=utcnow()))
        db.commit()
        if res.rowcount != 1:
            raise PasskeyError("Défi déjà utilisé.")
        return base64url_to_bytes(row.challenge)

    # ------------------------------------------------------------------ enregistrement
    @classmethod
    def register_options(cls, db: Session, customer: Customer) -> Dict[str, Any]:
        active = db.query(PasskeyCredential).filter(PasskeyCredential.customer_id == customer.id,
                                                    PasskeyCredential.revoked_at.is_(None)).all()
        if len(active) >= MAX_ACTIVE_PASSKEYS:
            raise PasskeyError("Nombre maximum de Passkeys atteint. Révoquez-en une avant d'en ajouter.")
        row, raw = cls._new_challenge(db, "register", customer.id)
        opts = generate_registration_options(
            rp_id=_rp_id(), rp_name=settings.PASSKEY_RP_NAME,
            user_id=customer.id.encode(), user_name=customer.phone, user_display_name=customer.name or customer.phone,
            challenge=raw,
            authenticator_selection=AuthenticatorSelectionCriteria(
                resident_key=ResidentKeyRequirement.REQUIRED, user_verification=UserVerificationRequirement.REQUIRED),
            exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(c.credential_id)) for c in active],
        )
        return {"challenge_id": row.id, "options": json.loads(options_to_json(opts))}

    @classmethod
    def register_verify(cls, db: Session, customer: Customer, challenge_id: str, credential: Dict[str, Any],
                        friendly_name: Optional[str] = None, ip: Optional[str] = None, user_agent: Optional[str] = None) -> PasskeyCredential:
        expected = cls._consume_challenge(db, challenge_id, "register", customer.id)
        try:
            v = verify_registration_response(credential=credential, expected_challenge=expected, expected_rp_id=_rp_id(),
                                             expected_origin=_origins(), require_user_verification=True)
        except Exception as e:
            cls.log_event(db, "passkey_register_failed", customer.id, ip=ip, user_agent=user_agent, reason=type(e).__name__)
            raise PasskeyError("Vérification de la Passkey impossible.")
        cred_id = bytes_to_base64url(v.credential_id)
        if db.query(PasskeyCredential).filter(PasskeyCredential.credential_id == cred_id).first():
            raise PasskeyError("Cette Passkey est déjà enregistrée.")
        transports = (credential.get("response") or {}).get("transports")
        cred = PasskeyCredential(
            customer_id=customer.id, credential_id=cred_id, public_key=v.credential_public_key, sign_count=v.sign_count,
            device_type=getattr(v.credential_device_type, "value", str(v.credential_device_type)),
            backed_up=bool(v.credential_backed_up), transports=json.dumps(transports) if transports else None,
            friendly_name=(friendly_name or "Appareil").strip()[:100])
        db.add(cred)
        db.commit()
        cls.log_event(db, "passkey_registered", customer.id, cred_id, ip, user_agent)
        return cred

    # ------------------------------------------------------------------ connexion
    @classmethod
    def login_options(cls, db: Session) -> Dict[str, Any]:
        """Connexion « discoverable » : aucun identifiant demandé, donc aucune fuite sur l'existence d'un compte."""
        row, raw = cls._new_challenge(db, "login", None)
        opts = generate_authentication_options(rp_id=_rp_id(), challenge=raw,
                                               user_verification=UserVerificationRequirement.REQUIRED)
        return {"challenge_id": row.id, "options": json.loads(options_to_json(opts))}

    @classmethod
    def login_verify(cls, db: Session, challenge_id: str, credential: Dict[str, Any],
                     ip: Optional[str] = None, user_agent: Optional[str] = None) -> Tuple[Customer, str]:
        expected = cls._consume_challenge(db, challenge_id, "login", None)
        cred_id = credential.get("id") or ""
        stored = db.query(PasskeyCredential).filter(PasskeyCredential.credential_id == cred_id).first()
        if not stored or stored.revoked_at is not None:
            cls.log_event(db, "passkey_login_unknown_credential", None, cred_id[:200], ip, user_agent)
            raise PasskeyError("Passkey inconnue ou révoquée.")
        customer = db.query(Customer).filter(Customer.id == stored.customer_id).first()
        if not customer or customer.is_blocked:
            cls.log_event(db, "passkey_login_blocked_account", stored.customer_id, cred_id, ip, user_agent)
            raise PasskeyError("Compte indisponible.")
        try:
            v = verify_authentication_response(
                credential=credential, expected_challenge=expected, expected_rp_id=_rp_id(), expected_origin=_origins(),
                credential_public_key=stored.public_key, credential_current_sign_count=stored.sign_count or 0,
                require_user_verification=True)
        except Exception as e:
            cls.log_event(db, "passkey_login_failed", customer.id, cred_id, ip, user_agent, reason=type(e).__name__)
            raise PasskeyError("Vérification de la Passkey impossible.")
        stored.sign_count = v.new_sign_count
        stored.last_used_at = utcnow()
        stored.backed_up = bool(v.credential_backed_up)
        token = cls.issue_session(db, customer)
        cls.log_event(db, "passkey_login", customer.id, cred_id, ip, user_agent)
        return customer, token

    @staticmethod
    def issue_session(db: Session, customer: Customer) -> str:
        """Réutilise la session client existante (Customer.session_token) : pas de second système d'authentification."""
        from app.services.customer_service import CustomerService
        token = secrets.token_urlsafe(32)
        CustomerService.set_session(customer, token)
        db.commit()
        return token

    # ------------------------------------------------------------------ gestion des Passkeys
    @staticmethod
    def list_passkeys(db: Session, customer: Customer) -> List[PasskeyCredential]:
        return (db.query(PasskeyCredential).filter(PasskeyCredential.customer_id == customer.id,
                                                   PasskeyCredential.revoked_at.is_(None))
                .order_by(PasskeyCredential.created_at).all())

    @classmethod
    def rename_passkey(cls, db: Session, customer: Customer, passkey_id: str, name: str) -> PasskeyCredential:
        c = db.query(PasskeyCredential).filter(PasskeyCredential.id == passkey_id, PasskeyCredential.customer_id == customer.id,
                                               PasskeyCredential.revoked_at.is_(None)).first()
        if not c:
            raise PasskeyError("Passkey introuvable.")
        c.friendly_name = (name or "").strip()[:100] or c.friendly_name
        db.commit()
        return c

    @classmethod
    def revoke_passkey(cls, db: Session, customer: Customer, passkey_id: str, ip=None, user_agent=None) -> None:
        c = db.query(PasskeyCredential).filter(PasskeyCredential.id == passkey_id, PasskeyCredential.customer_id == customer.id,
                                               PasskeyCredential.revoked_at.is_(None)).first()
        if not c:
            raise PasskeyError("Passkey introuvable.")
        c.revoked_at = utcnow()
        db.commit()
        cls.log_event(db, "passkey_revoked", customer.id, c.credential_id, ip, user_agent)

    # ------------------------------------------------------------------ codes de récupération
    @classmethod
    def generate_recovery_codes(cls, db: Session, customer: Customer, ip=None, user_agent=None) -> List[str]:
        """Invalide tous les anciens codes et en crée un nouveau jeu ; les codes en clair ne sont renvoyés qu'ici."""
        if not settings.RECOVERY_CODES_ENABLED:
            raise PasskeyError("Codes de récupération désactivés.")
        now = utcnow()
        db.query(RecoveryCode).filter(RecoveryCode.customer_id == customer.id, RecoveryCode.used_at.is_(None),
                                      RecoveryCode.revoked_at.is_(None)).update({"revoked_at": now})
        codes = []
        while len(codes) < RECOVERY_CODE_COUNT:
            raw = "".join(secrets.choice(_ALPHABET) for _ in range(8))
            code = f"{raw[:4]}-{raw[4:]}"
            if code not in codes:
                codes.append(code)
        for c in codes:
            db.add(RecoveryCode(customer_id=customer.id, code_hash=_hash_recovery_code(c)))
        db.commit()
        cls.log_event(db, "recovery_codes_generated", customer.id, ip=ip, user_agent=user_agent)
        return codes

    @classmethod
    def revoke_recovery_codes(cls, db: Session, customer: Customer) -> int:
        n = db.query(RecoveryCode).filter(RecoveryCode.customer_id == customer.id, RecoveryCode.used_at.is_(None),
                                          RecoveryCode.revoked_at.is_(None)).update({"revoked_at": utcnow()})
        db.commit()
        cls.log_event(db, "recovery_codes_revoked", customer.id)
        return n

    @staticmethod
    def remaining_recovery_codes(db: Session, customer: Customer) -> int:
        return db.query(RecoveryCode).filter(RecoveryCode.customer_id == customer.id, RecoveryCode.used_at.is_(None),
                                             RecoveryCode.revoked_at.is_(None)).count()

    @classmethod
    def use_recovery_code(cls, db: Session, phone: str, code: str, store_id: Optional[str] = None,
                          ip=None, user_agent=None) -> str:
        """Consomme un code et retourne un jeton de récupération LIMITÉ (sert uniquement à enregistrer une nouvelle Passkey)."""
        from app.services.customer_service import normalize_phone
        if not settings.RECOVERY_CODES_ENABLED:
            raise PasskeyError("Codes de récupération désactivés.")
        norm = normalize_phone(phone)
        if not norm:
            raise PasskeyError("Numéro de téléphone requis.")
        q = db.query(Customer).filter((Customer.phone == phone) | (Customer.phone == norm))
        if store_id:
            q = q.filter(Customer.store_id == store_id)
        ids = [c.id for c in q.all()]
        # Anti brute-force par numéro (en plus de la limite par IP du routeur), même si le compte n'existe pas.
        window = utcnow() - timedelta(minutes=15)
        fails = db.query(SecurityEvent).filter(SecurityEvent.event_type == "recovery_code_failed",
                                               SecurityEvent.event_metadata == json.dumps({"phone": norm}),
                                               SecurityEvent.created_at >= window).count()
        if fails >= MAX_RECOVERY_FAILURES:
            raise PasskeyError("Trop de tentatives. Réessayez dans quelques minutes.")
        row = None
        if ids:
            row = db.query(RecoveryCode).filter(RecoveryCode.customer_id.in_(ids), RecoveryCode.code_hash == _hash_recovery_code(code),
                                                RecoveryCode.used_at.is_(None), RecoveryCode.revoked_at.is_(None)).first()
        if not row:
            cls.log_event(db, "recovery_code_failed", ids[0] if len(ids) == 1 else None, ip=ip, user_agent=user_agent, phone=norm)
            raise PasskeyError("Code de récupération invalide ou déjà utilisé.")
        res = db.execute(update(RecoveryCode).where(RecoveryCode.id == row.id, RecoveryCode.used_at.is_(None),
                                                    RecoveryCode.revoked_at.is_(None)).values(used_at=utcnow()))
        db.commit()
        if res.rowcount != 1:
            raise PasskeyError("Code de récupération invalide ou déjà utilisé.")
        token = secrets.token_urlsafe(32)
        db.add(AuthChallenge(customer_id=row.customer_id, challenge=hashlib.sha256(token.encode()).hexdigest(), type="recovery",
                             expires_at=utcnow() + timedelta(minutes=RECOVERY_SESSION_MINUTES)))
        db.commit()
        cls.log_event(db, "recovery_code_used", row.customer_id, ip=ip, user_agent=user_agent)
        return token

    @classmethod
    def customer_from_recovery_token(cls, db: Session, token: Optional[str]) -> Optional[Customer]:
        if not token:
            return None
        row = db.query(AuthChallenge).filter(AuthChallenge.type == "recovery",
                                             AuthChallenge.challenge == hashlib.sha256(token.encode()).hexdigest(),
                                             AuthChallenge.consumed_at.is_(None), AuthChallenge.expires_at >= utcnow()).first()
        return db.query(Customer).filter(Customer.id == row.customer_id).first() if row else None

    @classmethod
    def consume_recovery_token(cls, db: Session, token: str) -> None:
        db.query(AuthChallenge).filter(AuthChallenge.type == "recovery",
                                       AuthChallenge.challenge == hashlib.sha256(token.encode()).hexdigest()
                                       ).update({"consumed_at": utcnow()})
        db.commit()

    # ------------------------------------------------------------------ sessions
    @classmethod
    def revoke_sessions(cls, db: Session, customer: Customer, ip=None, user_agent=None) -> None:
        from app.services.customer_service import CustomerService
        CustomerService.clear_session(customer)
        db.commit()
        cls.log_event(db, "sessions_revoked", customer.id, ip=ip, user_agent=user_agent)

    @staticmethod
    def list_events(db: Session, customer: Customer, limit: int = 50) -> List[SecurityEvent]:
        return (db.query(SecurityEvent).filter(SecurityEvent.customer_id == customer.id)
                .order_by(SecurityEvent.created_at.desc()).limit(min(max(limit, 1), 200)).all())
