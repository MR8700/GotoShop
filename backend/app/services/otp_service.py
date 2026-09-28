import hashlib
import hmac
import random
import time
from typing import Dict, Any, Tuple
from app.config import settings

# In-memory storage for OTP sessions: key -> {hash, salt, expires_at, attempts, order_id, amount}
_otp_store: Dict[str, Dict[str, Any]] = {}
_request_throttle: Dict[str, float] = {}

OTP_EXPIRY_SECONDS = 300  # 5 minutes
MAX_ATTEMPTS = 3
THROTTLE_SECONDS = 20     # Minimum interval between resends


class OtpService:
    @staticmethod
    def _hash_code(code: str, salt: str) -> str:
        secret = (getattr(settings, "OTP_SECRET", None) or "gotoshop-otp-secret").encode("utf-8")
        msg = f"{code}:{salt}".encode("utf-8")
        return hmac.new(secret, msg, hashlib.sha256).hexdigest()

    @staticmethod
    def request_otp(phone: str, order_id: str, amount: int) -> Tuple[bool, str, Dict[str, Any]]:
        """Generate and securely store a 6-digit OTP code."""
        clean_phone = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
        now = time.time()

        # Check throttle
        last_req = _request_throttle.get(clean_phone, 0)
        if now - last_req < THROTTLE_SECONDS:
            remaining = int(THROTTLE_SECONDS - (now - last_req))
            return False, f"Veuillez patienter {remaining}s avant de demander un nouveau code.", {}

        # Generate 6-digit numeric OTP
        code = f"{random.randint(100000, 999999)}"
        salt = hashlib.sha256(f"{now}:{clean_phone}:{order_id}".encode()).hexdigest()[:16]
        code_hash = OtpService._hash_code(code, salt)

        key = f"{clean_phone}:{order_id}"
        _otp_store[key] = {
            "hash": code_hash,
            "salt": salt,
            "expires_at": now + OTP_EXPIRY_SECONDS,
            "attempts": 0,
            "order_id": order_id,
            "amount": amount,
        }
        _request_throttle[clean_phone] = now

        is_simulator = getattr(settings, "PAYMENT_SIMULATOR", True)
        result_payload = {
            "expires_in": OTP_EXPIRY_SECONDS,
            "phone": clean_phone,
            "order_id": order_id,
            "is_simulated": is_simulator,
        }
        # In simulator mode, include code for convenient testing in development
        if is_simulator:
            result_payload["simulated_code"] = code

        return True, "Code de confirmation envoyé.", result_payload

    @staticmethod
    def verify_otp(phone: str, order_id: str, code: str) -> Tuple[bool, str]:
        """Verify the user-entered 6-digit code against server-held hash."""
        clean_phone = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
        clean_code = "".join(ch for ch in code if ch.isdigit()).strip()

        if len(clean_code) != 6:
            return False, "Le code doit comporter exactement 6 chiffres."

        key = f"{clean_phone}:{order_id}"
        record = _otp_store.get(key)
        if not record:
            return False, "Aucun code en attente ou session expirée. Veuillez redemander un code."

        now = time.time()
        if now > record["expires_at"]:
            _otp_store.pop(key, None)
            return False, "Le code a expiré (validité 5 minutes). Veuillez en demander un nouveau."

        if record["attempts"] >= MAX_ATTEMPTS:
            _otp_store.pop(key, None)
            return False, "Trop de tentatives erronées. La transaction a été verrouillée par sécurité."

        candidate_hash = OtpService._hash_code(clean_code, record["salt"])
        if not hmac.compare_digest(candidate_hash, record["hash"]):
            record["attempts"] += 1
            remaining = MAX_ATTEMPTS - record["attempts"]
            return False, f"Code incorrect. {remaining} tentative(s) restante(s)."

        # Consume OTP so it cannot be used again
        _otp_store.pop(key, None)
        return True, "Validation réussie."
