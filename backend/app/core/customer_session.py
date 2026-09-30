"""Session client : cookie HttpOnly + jeton haché en base + expiration.

- Le jeton brut n'existe qu'à l'émission (cookie HttpOnly) ; la base ne garde que son empreinte SHA-256 (préfixe h1$).
- Un middleware ASGI convertit le cookie en en-têtes (Authorization / X-Customer-Token) quand le client n'en envoie pas,
  et pose / efface le cookie quand un service émet ou révoque une session. Les en-têtes explicites restent prioritaires
  (compatibilité API, outils, tests).
"""
from contextvars import ContextVar
from datetime import timedelta
from http.cookies import SimpleCookie
from typing import Optional

from app.config import settings
from app.core.clock import utcnow

# Valeur non secrète que le JavaScript envoie à la place du jeton (qu'il ne peut pas lire) : « utilise mon cookie ».
COOKIE_MARKER = "__cookie__"

_HOLDER: ContextVar[Optional[dict]] = ContextVar("customer_session_holder", default=None)


def session_expiry():
    return utcnow() + timedelta(days=settings.CUSTOMER_SESSION_TTL_DAYS)


def queue_cookie(raw_token: str) -> None:
    h = _HOLDER.get()
    if h is not None:
        h["issue"] = raw_token
        h.pop("clear", None)


def queue_clear_cookie() -> None:
    h = _HOLDER.get()
    if h is not None:
        h["clear"] = True
        h.pop("issue", None)


def cookie_token() -> Optional[str]:
    h = _HOLDER.get()
    return h.get("cookie") if h else None


def _cookie_header(value: str, max_age: int) -> bytes:
    parts = [f"{settings.CUSTOMER_COOKIE_NAME}={value}", "Path=/", "HttpOnly",
             f"SameSite={settings.CUSTOMER_COOKIE_SAMESITE}", f"Max-Age={max_age}"]
    if settings.CUSTOMER_COOKIE_SECURE:
        parts.append("Secure")
    return "; ".join(parts).encode("latin-1")


class CustomerSessionMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = list(scope.get("headers") or [])
        cookie_val = None
        for k, v in headers:
            if k.lower() == b"cookie":
                try:
                    c = SimpleCookie(); c.load(v.decode("latin-1"))
                    m = c.get(settings.CUSTOMER_COOKIE_NAME)
                    cookie_val = m.value if m else None
                except Exception:
                    cookie_val = None
        # Le marqueur envoyé par le frontend est remplacé par le vrai jeton du cookie (ou supprimé s'il n'y a pas de cookie).
        marker = COOKIE_MARKER.encode()
        cleaned = []
        for k, v in headers:
            kl = k.lower()
            if kl in (b"authorization", b"x-customer-token") and v.strip() in (marker, b"Bearer " + marker):
                if cookie_val:
                    v = (b"Bearer " if kl == b"authorization" else b"") + cookie_val.encode("latin-1", "ignore")
                else:
                    continue
            cleaned.append((k, v))
        headers = cleaned
        names = {k.lower() for k, _ in headers}
        if cookie_val:
            tok = cookie_val.encode("latin-1", "ignore")
            if b"x-customer-token" not in names:
                headers.append((b"x-customer-token", tok))
            if b"authorization" not in names:
                headers.append((b"authorization", b"Bearer " + tok))
            scope = {**scope, "headers": headers}
        holder = {"cookie": cookie_val}
        reset = _HOLDER.set(holder)

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                extra = None
                if holder.get("issue"):
                    extra = _cookie_header(holder["issue"], settings.CUSTOMER_SESSION_TTL_DAYS * 86400)
                elif holder.get("clear"):
                    extra = _cookie_header("", 0)
                if extra:
                    message = {**message, "headers": list(message.get("headers") or []) + [(b"set-cookie", extra)]}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            _HOLDER.reset(reset)
