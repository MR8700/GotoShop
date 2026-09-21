import urllib.parse
from typing import Dict, Any
from app.adapters.base import BaseChannelAdapter

class SMSAdapter(BaseChannelAdapter):
    def channel_type(self) -> str:
        return "SMS"

    def format_message(self, context: Dict[str, Any]) -> str:
        product_name = context.get("product_name", "Produit")
        qty = context.get("quantity", 1)
        ref = context.get("reference_code", "")
        city = context.get("delivery_city", "Abidjan")
        msg = f"Bonjour ! Commande {ref}: {qty}x {product_name} pour {city}."
        location_url = context.get("customer_location_url")
        if location_url:
            msg += f" GPS: {location_url}"
        return msg

    def build_redirect_url(self, account_handle: str, context: Dict[str, Any]) -> str:
        clean_number = "".join(c for c in account_handle if c.isdigit() or c == "+")
        msg = self.format_message(context)
        encoded_msg = urllib.parse.quote(msg)
        return f"sms:{clean_number}?body={encoded_msg}"

    def get_ui_meta(self) -> Dict[str, Any]:
        return {
            "icon": "sms",
            "theme_color": "#8084ff",
            "btn_label": "Envoyer un SMS Direct",
            "btn_class": "bg-tertiary-container text-on-tertiary-container shadow-tertiary-container/20",
        }
