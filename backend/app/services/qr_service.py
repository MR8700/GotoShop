"""
QR Code + print layout generator for GotoShop stores.

Uses the real QR encoder (app.services.qr_encoder): the codes are genuine,
scannable ISO 18004 QR Codes (the former implementation only drew a
placeholder pattern that no phone could read).
"""
from typing import Dict, Any
import html

from app.config import settings
from app.services.qr_encoder import encode_text, to_svg, ECC_M


def store_public_url(slug: str, origin: str = "") -> str:
    """Canonical public URL of a store (the SPA resolves /store/<slug>)."""
    base = (origin or settings.FRONTEND_URL or "").rstrip("/")
    return f"{base}/store/{slug}"


def _generate_qr_svg(url: str, title: str = "GotoShop Store", primary_color: str = "#0f172a",
                     border: int = 4) -> str:
    """Genuine scannable QR Code as a compact vector SVG (scales without loss)."""
    qr = encode_text(url, ECC_M, boost_ecl=True)
    return to_svg(qr, border=border, dark=primary_color, light="#ffffff", title=title)


class QRService:
    PRINT_FORMATS = [
        {
            "id": "AFFICHE_A4",
            "name": "Affiche Vitrine / Comptoir (A4)",
            "description": "Idéal pour suspendre en vitrine ou poser à la caisse du magasin",
            "dimensions": "210 x 297 mm",
            "icon": "storefront",
        },
        {
            "id": "CARTE_VISITE",
            "name": "Carte de Visite / Chevalet",
            "description": "Format de poche à glisser dans les commandes de vos clients",
            "dimensions": "85 x 55 mm",
            "icon": "badge",
        },
        {
            "id": "STICKER_COLIS",
            "name": "Sticker Emballage & Colis",
            "description": "Autocollant à apposer sur vos sacs et cartons de livraison",
            "dimensions": "70 x 70 mm",
            "icon": "local_offer",
        },
        {
            "id": "FORMAT_CARRE",
            "name": "Format Carré Réseaux Sociaux",
            "description": "Pour vos statuts WhatsApp, stories Instagram et publications TikTok",
            "dimensions": "1080 x 1080 px",
            "icon": "grid_view",
        },
    ]

    @staticmethod
    def get_store_qr(store, base_url: str = "") -> Dict[str, Any]:
        slug = store.slug
        # Encode the origin the API is actually reached through (correct in prod behind
        # the Vercel rewrite); fall back to settings.FRONTEND_URL when unknown.
        full_web_url = store_public_url(slug, base_url)
        public_url = f"{base_url}/store/{slug}" if base_url else f"/store/{slug}"

        svg_content = _generate_qr_svg(
            url=full_web_url,
            title=store.name,
            primary_color="#0f172a",
        )

        return {
            "store_id": store.id,
            "store_name": store.name,
            "store_slug": store.slug,
            "tagline": store.tagline or "Découvrez nos créations en direct sur GotoShop",
            "logo_url": store.logo_url or store.avatar_url,
            "public_url": public_url,
            "full_web_url": full_web_url,
            "qr_svg": svg_content,
            "instruction": "Scannez pour découvrir notre boutique",
            "formats": QRService.PRINT_FORMATS,
        }

    @staticmethod
    def generate_store_qr_svg(slug: str, store_name: str = "GotoShop Store", format_preset: str = "square") -> str:
        url = store_public_url(slug)
        svg_raw = _generate_qr_svg(url=url, title=store_name)
        if format_preset != "poster_a4":
            return svg_raw
        # Nested <svg> with explicit box so the QR keeps its aspect ratio on the poster.
        qr_inner = svg_raw.replace("<svg ", '<svg x="150" y="250" width="500" height="500" ', 1)
        name = html.escape(store_name)
        shown = html.escape(url.replace("https://", "").replace("http://", ""))
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1131" width="100%" height="100%">
  <rect width="800" height="1131" fill="#f8fafc" />
  <rect x="40" y="40" width="720" height="1051" rx="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="3" />
  <text x="400" y="140" text-anchor="middle" font-family="system-ui, sans-serif" font-size="36" font-weight="900" fill="#0f172a">{name}</text>
  <text x="400" y="185" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#64748b">Scannez pour commander en direct</text>
  {qr_inner}
  <text x="400" y="800" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="700" fill="#3b82f6">{shown}</text>
  <text x="400" y="840" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">Commerce conversationnel intégré • Paiement Mobile Money &amp; Suivi direct</text>
</svg>"""
