"""Réinitialisation du mot de passe de sécurité d'un commerçant.

Voie 1 : OTP à 6 chiffres envoyé par WhatsApp (haché, expirant, 5 essais max, usage unique).
Voie 2 : le super-admin génère un mot de passe temporaire à copier/envoyer (voir routers/super_admin.py).
La réponse de la demande est identique que le compte existe ou non (pas d'énumération).
"""
import secrets
from datetime import timedelta
from typing import Optional
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.config import settings
from app.core.clock import utcnow
from app.core.security import hash_password, validate_strong_password, lookup_hash
from app.models.passkey import PasswordResetOtp
from app.models.store import Owner
from app.services.sms_service import send_whatsapp

MAX_ATTEMPTS = 5
GENERIC_MSG = "Si ce compte existe, un code de réinitialisation vient d'être envoyé sur WhatsApp."


def _digits(phone: str) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit())


def whatsapp_link(phone: str, message: str) -> str:
    return f"https://wa.me/{_digits(phone)}?text={quote(message)}"


def _hash(owner_id: str, code: str) -> str:
    return lookup_hash(f"{owner_id}:{code}")


class PasswordResetService:
    @staticmethod
    def request(db: Session, identifier: str) -> dict:
        ident = (identifier or "").strip().lower()
        owner: Optional[Owner] = db.query(Owner).filter(Owner.email == ident).first() if "@" in ident else None
        if not owner and _digits(ident):
            d = _digits(ident)
            owner = next((o for o in db.query(Owner).all() if _digits(o.phone_number).endswith(d[-8:]) and len(d) >= 8), None)
        result = {"success": True, "message": GENERIC_MSG}
        if not owner:
            return result
        now = utcnow()
        # un seul code actif : les précédents sont invalidés
        db.query(PasswordResetOtp).filter(PasswordResetOtp.owner_id == owner.id,
                                          PasswordResetOtp.consumed_at.is_(None)).update({"consumed_at": now})
        code = f"{secrets.randbelow(10**6):06d}"
        db.add(PasswordResetOtp(owner_id=owner.id, code_hash=_hash(owner.id, code),
                                expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_OTP_TTL_MINUTES)))
        db.commit()
        ok, detail = send_whatsapp(
            owner.phone_number,
            f"GotoShop : votre code de réinitialisation est {code}. Valable {settings.PASSWORD_RESET_OTP_TTL_MINUTES} min. "
            "Ne le partagez jamais.")
        # Le code n'est renvoyé qu'en mode simulateur, jamais en production.
        if not ok and settings.PAYMENT_SIMULATOR and settings.APP_ENV == "dev":
            result["dev_code"] = code
        return result

    @staticmethod
    def confirm(db: Session, identifier: str, code: str, new_password: str, confirm_password: str) -> None:
        if new_password != confirm_password:
            raise ValueError("Le mot de passe et sa confirmation ne correspondent pas.")
        strong, errors = validate_strong_password(new_password)
        if not strong:
            raise ValueError(errors[0])
        ident = (identifier or "").strip().lower()
        owner = db.query(Owner).filter(Owner.email == ident).first() if "@" in ident else None
        if not owner and _digits(ident):
            d = _digits(ident)
            owner = next((o for o in db.query(Owner).all() if _digits(o.phone_number).endswith(d[-8:]) and len(d) >= 8), None)
        row = None
        if owner:
            row = (db.query(PasswordResetOtp).filter(PasswordResetOtp.owner_id == owner.id,
                                                     PasswordResetOtp.consumed_at.is_(None))
                   .order_by(PasswordResetOtp.created_at.desc()).first())
        if not owner or not row or row.expires_at < utcnow() or (row.attempts or 0) >= MAX_ATTEMPTS:
            raise ValueError("Code invalide ou expiré.")
        row.attempts = (row.attempts or 0) + 1
        if not secrets.compare_digest(row.code_hash, _hash(owner.id, (code or "").strip())):
            db.commit()
            raise ValueError("Code invalide ou expiré.")
        row.consumed_at = utcnow()
        owner.password_hash, owner.password_salt = hash_password(new_password)
        owner.must_change_password = False
        owner.failed_login_attempts = 0
        owner.locked_until = None
        owner.session_token = None  # toutes les sessions existantes sont fermées
        db.commit()
