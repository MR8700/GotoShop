"""Abstraction de vérification téléphonique (activable plus tard via OTP_REQUIRED_FOR_ACCOUNT_RECOVERY=true).

Aucun composant ne doit appeler un fournisseur SMS directement : passer par get_phone_verification_provider().
Pour ajouter un fournisseur (local, international...), implémenter PhoneVerificationProvider.
"""
from abc import ABC, abstractmethod
from typing import Tuple


class PhoneVerificationProvider(ABC):
    @abstractmethod
    def send(self, phone: str, context: str) -> Tuple[bool, str]:
        """Envoie un code de vérification. Retourne (succès, message)."""

    @abstractmethod
    def verify(self, phone: str, context: str, code: str) -> Tuple[bool, str]:
        """Vérifie le code reçu. Retourne (succès, message)."""


class SmsOtpProvider(PhoneVerificationProvider):
    """Fournisseur par défaut : réutilise OtpService (SMS_PROVIDER = simulator / webhook / twilio)."""

    def send(self, phone: str, context: str) -> Tuple[bool, str]:
        from app.services.otp_service import OtpService
        ok, msg, _ = OtpService.request_otp(phone, context, 0)
        return ok, msg

    def verify(self, phone: str, context: str, code: str) -> Tuple[bool, str]:
        from app.services.otp_service import OtpService
        return OtpService.verify_otp(phone, context, code)


def get_phone_verification_provider() -> PhoneVerificationProvider:
    return SmsOtpProvider()
