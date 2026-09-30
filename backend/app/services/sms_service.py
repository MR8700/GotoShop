"""Envoi de SMS. Fournisseur choisi par SMS_PROVIDER : 'simulator' (défaut, aucun envoi), 'webhook' ou 'twilio'.

- webhook : POST JSON {"to": ..., "message": ...} vers SMS_WEBHOOK_URL (en-tête Authorization: Bearer SMS_WEBHOOK_TOKEN si défini).
- twilio  : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM.
"""
import base64
import json
import urllib.parse
import urllib.request
from typing import Tuple
from app.config import settings


def _post(url: str, data: bytes, headers: dict) -> None:
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:  # noqa: S310
        if resp.status >= 300:
            raise RuntimeError(f"HTTP {resp.status}")


def sms_configured() -> bool:
    return settings.SMS_PROVIDER in ("webhook", "twilio")


def send_sms(to: str, message: str) -> Tuple[bool, str]:
    provider = settings.SMS_PROVIDER
    try:
        if provider == "webhook":
            if not settings.SMS_WEBHOOK_URL:
                return False, "SMS_WEBHOOK_URL non défini."
            headers = {"Content-Type": "application/json"}
            if settings.SMS_WEBHOOK_TOKEN:
                headers["Authorization"] = f"Bearer {settings.SMS_WEBHOOK_TOKEN}"
            _post(settings.SMS_WEBHOOK_URL, json.dumps({"to": to, "message": message}).encode(), headers)
            return True, "envoyé"
        if provider == "twilio":
            sid, tok, sender = settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM
            if not (sid and tok and sender):
                return False, "Identifiants Twilio incomplets."
            auth = base64.b64encode(f"{sid}:{tok}".encode()).decode()
            body = urllib.parse.urlencode({"To": to, "From": sender, "Body": message}).encode()
            _post(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", body,
                  {"Authorization": f"Basic {auth}", "Content-Type": "application/x-www-form-urlencoded"})
            return True, "envoyé"
    except Exception as e:  # réseau, fournisseur indisponible…
        return False, f"Échec d'envoi SMS : {e}"
    return False, "Aucun fournisseur SMS configuré."


def whatsapp_configured() -> bool:
    return bool(settings.WHATSAPP_WEBHOOK_URL) or sms_configured()


def send_whatsapp(to: str, message: str) -> Tuple[bool, str]:
    """Envoie un message WhatsApp via le webhook dédié ; repli sur le fournisseur SMS s'il n'y en a pas."""
    if settings.WHATSAPP_WEBHOOK_URL:
        try:
            headers = {"Content-Type": "application/json"}
            if settings.WHATSAPP_WEBHOOK_TOKEN:
                headers["Authorization"] = f"Bearer {settings.WHATSAPP_WEBHOOK_TOKEN}"
            _post(settings.WHATSAPP_WEBHOOK_URL, json.dumps({"to": to, "message": message, "channel": "whatsapp"}).encode(), headers)
            return True, "envoyé"
        except Exception as e:
            return False, f"Échec d'envoi WhatsApp : {e}"
    return send_sms(to, message)
