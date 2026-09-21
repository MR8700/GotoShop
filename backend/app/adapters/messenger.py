import urllib.parse
from typing import Dict, Any
from app.adapters.base import BaseChannelAdapter

class MessengerAdapter(BaseChannelAdapter):
    def channel_type(self) -> str:
        return "MESSENGER"

    def format_message(self, context: Dict[str, Any]) -> str:
        product_name = context.get("product_name", "Produit")
        qty = context.get("quantity", 1)
        ref = context.get("reference_code", "")
        return f"Bonjour ! Intention de commande {ref} pour {qty}x {product_name}."

    def build_redirect_url(self, account_handle: str, context: Dict[str, Any]) -> str:
        page_id = account_handle.strip("/@")
        ref = context.get("reference_code", "")
        return f"https://m.me/{page_id}?ref={urllib.parse.quote(ref)}"

    def get_ui_meta(self) -> Dict[str, Any]:
        return {
            "icon": "forum",
            "theme_color": "#0084FF",
            "btn_label": "Discuter sur Messenger Facebook",
            "btn_class": "bg-[#0084FF] text-on-surface shadow-[#0084FF]/20",
        }
