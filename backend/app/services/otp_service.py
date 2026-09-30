import hashlib
import hmac
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple
from app.config import settings
from app.core.clock import utcnow

OTP_EXPIRY_SECONDS = 300  # 5 minutes
MAX_ATTEMPTS = 3
THROTTLE_SECONDS = 20     # Intervalle minimal entre deux envois


def _clean_phone(phone: str) -> str:
    return "".join(ch for ch in (phone or "") if ch.isdigit() or ch == "+")


class OtpService:
    """Codes OTP stockés en base (table otp_codes), hachés en HMAC : compatible Vercel / multi-instances."""

    @staticmethod
    def _hash_code(code: str, salt: str) -> str:
        secret = (getattr(settings, "OTP_SECRET", None) or "gotoshop-otp-secret").encode("utf-8")
        return hmac.new(secret, f"{code}:{salt}".encode("utf-8"), hashlib.sha256).hexdigest()

    @staticmethod
    def _session():
        from app.database import SessionLocal
        return SessionLocal()

    @staticmethod
    def request_otp(phone: str, order_id: str, amount: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Génère un code à 6 chiffres, le stocke haché, puis l'envoie par SMS (ou le renvoie en mode simulateur)."""
        from app.models.otp import OtpCode
        from app.services.sms_service import send_sms, sms_configured
        clean_phone = _clean_phone(phone)
        now = utcnow()
        key = f"{clean_phone}:{order_id}"
        simulator = bool(getattr(settings, "PAYMENT_SIMULATOR", True)) and not sms_configured()
        if not simulator and not sms_configured():
            return False, "Envoi de SMS non configuré : impossible d'envoyer le code.", {}

        db = OtpService._session()
        try:
            last = db.query(OtpCode).filter(OtpCode.phone == clean_phone).order_by(OtpCode.created_at.desc()).first()
            if last and (now - last.created_at).total_seconds() < THROTTLE_SECONDS:
                remaining = int(THROTTLE_SECONDS - (now - last.created_at).total_seconds())
                return False, f"Veuillez patienter {remaining}s avant de demander un nouveau code.", {}

            code = f"{secrets.randbelow(900000) + 100000}"
            salt = secrets.token_hex(8)
            db.query(OtpCode).filter(OtpCode.key == key).delete()
            db.query(OtpCode).filter(OtpCode.expires_at < now).delete()  # purge des codes périmés
            db.add(OtpCode(key=key, phone=clean_phone, code_hash=OtpService._hash_code(code, salt), salt=salt,
                           amount=int(amount or 0), created_at=now, expires_at=now + timedelta(seconds=OTP_EXPIRY_SECONDS)))
            db.commit()
        finally:
            db.close()

        payload: Dict[str, Any] = {"expires_in": OTP_EXPIRY_SECONDS, "phone": clean_phone, "order_id": order_id,
                                   "is_simulated": simulator}
        if simulator:
            payload["simulated_code"] = code
        else:
            ok, info = send_sms(clean_phone, f"GotoShop : votre code de confirmation est {code}. Valable 5 minutes.")
            if not ok:
                db = OtpService._session()
                try:
                    db.query(OtpCode).filter(OtpCode.key == key).delete()
                    db.commit()
                finally:
                    db.close()
                return False, info, {}
        return True, "Code de confirmation envoyé.", payload

    @staticmethod
    def verify_otp(phone: str, order_id: str, code: str) -> Tuple[bool, str]:
        from app.models.otp import OtpCode
        clean_phone = _clean_phone(phone)
        clean_code = "".join(ch for ch in (code or "") if ch.isdigit()).strip()
        if len(clean_code) != 6:
            return False, "Le code doit comporter exactement 6 chiffres."

        key = f"{clean_phone}:{order_id}"
        db = OtpService._session()
        try:
            record = db.query(OtpCode).filter(OtpCode.key == key).order_by(OtpCode.created_at.desc()).first()
            if not record:
                return False, "Aucun code en attente ou session expirée. Veuillez redemander un code."
            if utcnow() > record.expires_at:
                db.delete(record); db.commit()
                return False, "Le code a expiré (validité 5 minutes). Veuillez en demander un nouveau."
            if (record.attempts or 0) >= MAX_ATTEMPTS:
                db.delete(record); db.commit()
                return False, "Trop de tentatives erronées. La transaction a été verrouillée par sécurité."
            if not hmac.compare_digest(OtpService._hash_code(clean_code, record.salt), record.code_hash):
                record.attempts = (record.attempts or 0) + 1
                remaining = MAX_ATTEMPTS - record.attempts
                db.commit()
                return False, f"Code incorrect. {remaining} tentative(s) restante(s)."
            db.delete(record); db.commit()  # usage unique
            return True, "Validation réussie."
        finally:
            db.close()
