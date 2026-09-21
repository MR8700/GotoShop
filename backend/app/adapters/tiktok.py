import urllib.parse
from typing import Dict, Any
from app.adapters.base import BaseChannelAdapter

class TikTokAdapter(BaseChannelAdapter):
    def channel_type(self) -> str:
        return "TIKTOK"

    def format_message(self, context: Dict[str, Any]) -> str:
        product_name = context.get("product_name", "Produit")
        ref = context.get("reference_code", "")
        return f"Bonjour ! Je viens depuis la boutique pour {product_name} (Réf: {ref})"

    def build_redirect_url(self, account_handle: str, context: Dict[str, Any]) -> str:
        handle = account_handle.lstrip("@")
        return f"https://www.tiktok.com/@{handle}"

    def get_ui_meta(self) -> Dict[str, Any]:
        return {
            "icon": "smart_display",
            "theme_color": "#FE2C55",
            "btn_label": "Envoyer un TikTok DM",
            "btn_class": "bg-[#FE2C55] text-on-surface shadow-[#FE2C55]/20",
        }
