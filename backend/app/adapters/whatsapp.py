import urllib.parse
from typing import Dict, Any
from app.adapters.base import BaseChannelAdapter

class WhatsAppAdapter(BaseChannelAdapter):
    def channel_type(self) -> str:
        return "WHATSAPP"

    def format_message(self, context: Dict[str, Any]) -> str:
        product_name = context.get("product_name", "Produit")
        qty = context.get("quantity", 1)
        color = context.get("selected_color", "")
        city = context.get("delivery_city", "Abidjan")
        ref = context.get("reference_code", "")
        price = context.get("total_amount", 0)
        currency = context.get("currency", "FCFA")
        owner_name = context.get("owner_name", "Awa")

        color_str = f" ({color})" if color else ""
        msg = f"Bonjour {owner_name}, je confirme l'achat de {qty}x {product_name}{color_str} pour {city}. Réf: {ref}"
        location_url = context.get("customer_location_url")
        if location_url:
            msg += f"\n📍 Ma position de livraison exacte : {location_url}"
        return msg

    def build_redirect_url(self, account_handle: str, context: Dict[str, Any]) -> str:
        phone = "".join(filter(str.isdigit, account_handle))
        msg = self.format_message(context)
        encoded_msg = urllib.parse.quote(msg)
        return f"https://wa.me/{phone}?text={encoded_msg}"

    def get_ui_meta(self) -> Dict[str, Any]:
        return {
            "icon": "chat",
            "theme_color": "#25D366",
            "btn_label": "Ouvrir la conversation WhatsApp",
            "btn_class": "bg-[#25D366] text-surface-container-lowest shadow-[#25D366]/20",
        }
