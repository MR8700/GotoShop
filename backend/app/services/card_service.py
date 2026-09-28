"""
Loyalty card identity and anti-forgery.

Every customer gets:
  * a 16-digit card number (prefix 7, Luhn check digit) stored in customers.loyalty_card_no;
  * an authenticity code = HMAC-SHA256(secret, card | store | customer) truncated to 80 bits,
    encoded in base32 (16 chars, displayed as 4 groups of 4).

The QR code printed on the card points to  <origin>/verify/<card>/<code>.
The public verification endpoint recomputes the HMAC on the server, so a forged or edited
card (different number, different holder, invented code) cannot validate: without the secret
key nobody can produce a matching code, and the data shown on the verification page comes
from the database, never from the card itself.
"""
import base64
import hashlib
import hmac
import os
import re
import uuid
from pathlib import Path
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from app.config import settings
from app.models.customer import Customer

_CARD_PREFIX = "7"
_CODE_LEN = 16
_key_cache: Optional[bytes] = None


def _signing_key() -> bytes:
    """Resolve the HMAC secret: env var > local key file (dev) > derived from private settings."""
    global _key_cache
    if _key_cache:
        return _key_cache
    key = (getattr(settings, "CARD_SIGNING_KEY", None) or os.getenv("CARD_SIGNING_KEY", "")).strip()
    if key:
        _key_cache = key.encode("utf-8")
        return _key_cache
    key_file = Path(settings.BASE_DIR) / "backend" / ".card_signing_key"
    try:
        if key_file.exists():
            _key_cache = key_file.read_text().strip().encode("utf-8")
        else:
            key_file.parent.mkdir(parents=True, exist_ok=True)
            fresh = uuid.uuid4().hex + uuid.uuid4().hex
            key_file.write_text(fresh)
            try:
                os.chmod(key_file, 0o600)
            except OSError:
                pass
            _key_cache = fresh.encode("utf-8")
        if _key_cache:
            print("[Cards] CARD_SIGNING_KEY not set: using a local key file. Set CARD_SIGNING_KEY in production.")
            return _key_cache
    except OSError:
        pass
    # Read-only filesystem (serverless): derive a stable key from private deployment settings.
    material = f"gs-card|{settings.DATABASE_URL}|{settings.SUPABASE_KEY}"
    _key_cache = hashlib.sha256(material.encode("utf-8")).digest()
    print("[Cards] CARD_SIGNING_KEY not set: derived from deployment settings. Set CARD_SIGNING_KEY in production.")
    return _key_cache


def luhn_check_digit(payload: str) -> str:
    total = 0
    for i, ch in enumerate(reversed(payload)):
        d = int(ch)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return str((10 - total % 10) % 10)


def luhn_valid(number: str) -> bool:
    return bool(re.fullmatch(r"\d{16}", number or "")) and luhn_check_digit(number[:-1]) == number[-1]


def _digits_from_hmac(seed: str, count: int) -> str:
    digest = hmac.new(_signing_key(), seed.encode("utf-8"), hashlib.sha256).digest()
    return "".join(str(b % 10) for b in digest)[:count]


def compute_code(card_no: str, store_id: str, customer_id: str) -> str:
    msg = f"GS1|{card_no}|{store_id}|{customer_id}".encode("utf-8")
    mac = hmac.new(_signing_key(), msg, hashlib.sha256).digest()[:10]
    return base64.b32encode(mac).decode("ascii").rstrip("=")[:_CODE_LEN]


def format_card_no(card_no: str) -> str:
    return " ".join(card_no[i:i + 4] for i in range(0, 16, 4))


def format_code(code: str) -> str:
    return "-".join(code[i:i + 4] for i in range(0, len(code), 4))


def ensure_card_number(db: Session, customer: Customer) -> str:
    """Assign (once) and return the customer's card number."""
    if customer.loyalty_card_no and luhn_valid(customer.loyalty_card_no):
        return customer.loyalty_card_no
    for attempt in range(20):
        body = _CARD_PREFIX + _digits_from_hmac(f"num|{customer.id}|{attempt}", 14)
        number = body + luhn_check_digit(body)
        clash = db.query(Customer.id).filter(Customer.loyalty_card_no == number).first()
        if not clash:
            customer.loyalty_card_no = number
            db.commit()
            return number
    raise RuntimeError("Impossible d'attribuer un numéro de carte unique")


def public_origin(request=None) -> str:
    """Stable public origin for verification URLs (FRONTEND_URL, else the request's origin)."""
    configured = (settings.FRONTEND_URL or "").rstrip("/")
    if configured and "localhost" not in configured and "127.0.0.1" not in configured:
        return configured
    if request is not None:
        base = str(request.base_url).rstrip("/")
        if "127.0.0.1" in base or "localhost" in base:
            return configured or "http://localhost:5173"
        return base
    return configured or "http://localhost:5173"


def build_card_payload(db: Session, customer: Customer, store, stats, origin: str) -> Dict[str, Any]:
    """Everything the front-end needs to draw/print the card."""
    card_no = ensure_card_number(db, customer)
    code = compute_code(card_no, customer.store_id, customer.id)
    tiers = stats.all_tiers or []
    tier_rank = 0
    for i, t in enumerate(tiers):
        if t.get("name") == stats.loyalty_tier:
            tier_rank = i
    return {
        "card_number": card_no,
        "card_number_formatted": format_card_no(card_no),
        "security_code": code,
        "security_code_formatted": format_code(code),
        "verify_url": f"{origin}/verify/{card_no}/{code}",
        "holder_name": customer.name,
        "member_since": customer.created_at,
        "points": stats.loyalty_points,
        "tier_name": stats.loyalty_tier,
        "tier_rank": tier_rank,
        "tier_count": max(len(tiers), 1),
        "next_tier": stats.next_tier,
        "next_tier_progress": stats.next_tier_progress,
        "is_blocked": bool(customer.is_blocked),
        "store": {
            "id": store.id,
            "slug": store.slug,
            "name": store.name,
            "logo_url": store.logo_url or store.avatar_url,
            "primary_color": store.primary_color,
            "secondary_color": store.secondary_color,
            "tagline": store.tagline,
            "city": store.city,
            "whatsapp": store.contact_whatsapp,
        },
    }


def _mask_holder(name: str) -> str:
    parts = (name or "").strip().split()
    if not parts:
        return "Client"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


def verify_card(db: Session, card_no: str, code: str, stats_fn=None) -> Dict[str, Any]:
    """Public verification. Reveals only what a shopkeeper needs (masked holder, tier, points)."""
    invalid = {"valid": False}
    card_no = re.sub(r"\D", "", card_no or "")
    code = re.sub(r"[^A-Z2-7]", "", (code or "").upper())
    if not luhn_valid(card_no) or len(code) != _CODE_LEN:
        return invalid
    customer = db.query(Customer).filter(Customer.loyalty_card_no == card_no).first()
    if not customer:
        return invalid
    expected = compute_code(card_no, customer.store_id, customer.id)
    if not hmac.compare_digest(expected, code):
        return invalid

    from app.models.store import Store
    store = db.query(Store).filter(Store.id == customer.store_id).first()
    stats = stats_fn(db, customer) if stats_fn else None
    return {
        "valid": True,
        "status": "SUSPENDED" if customer.is_blocked else "ACTIVE",
        "holder": _mask_holder(customer.name),
        "card_number_masked": f"•••• •••• •••• {card_no[-4:]}",
        "member_since": customer.created_at.isoformat() if customer.created_at else None,
        "tier": stats.loyalty_tier if stats else None,
        "points": stats.loyalty_points if stats else None,
        "store": {
            "name": store.name if store else None,
            "slug": store.slug if store else None,
            "logo_url": (store.logo_url or store.avatar_url) if store else None,
            "primary_color": store.primary_color if store else None,
            "is_verified": bool(store.is_verified) if store else False,
        },
    }
