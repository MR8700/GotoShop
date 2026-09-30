import json
from typing import Any, Dict, List, Optional

from app.services.catalog_service import save_base64_media

MAX_SPOT_IMAGES = 6
MAX_IMAGE_B64_CHARS = 4_000_000  # ~3 Mo par image


def load_json(raw: Optional[str], default: Any = None) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


def spot_to_dict(s) -> Dict[str, Any]:
    return {
        "id": s.id,
        "kind": s.kind,
        "name": s.name,
        "city": s.city,
        "address": s.address,
        "description": s.description,
        "hours": s.hours,
        "images": load_json(s.image_urls, []) or [],
        "latitude": s.latitude,
        "longitude": s.longitude,
        "delivery_fee": s.delivery_fee,
        "is_active": bool(s.is_active),
        "display_order": s.display_order or 0,
    }


def store_images(images: Optional[List[str]]) -> List[str]:
    """Garde les URLs existantes et enregistre les nouvelles images (data URI base64)."""
    out: List[str] = []
    for img in (images or [])[:MAX_SPOT_IMAGES]:
        if not isinstance(img, str) or not img:
            continue
        if img.startswith("data:"):
            if not img.startswith("data:image/"):
                raise ValueError("Seules les images sont acceptées.")
            if len(img) > MAX_IMAGE_B64_CHARS:
                raise ValueError("Image trop lourde (3 Mo maximum par image).")
            url = save_base64_media(img, prefix="store_spot")
            if url:
                out.append(url)
        elif img.startswith(("/media/", "http://", "https://")):
            out.append(img)
    return out
