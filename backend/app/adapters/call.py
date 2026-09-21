from typing import Dict, Any
from app.adapters.base import BaseChannelAdapter

class CallAdapter(BaseChannelAdapter):
    def channel_type(self) -> str:
        return "CALL"

    def format_message(self, context: Dict[str, Any]) -> str:
        ref = context.get("reference_code", "")
        return f"Commande {ref}"

    def build_redirect_url(self, account_handle: str, context: Dict[str, Any]) -> str:
        clean_number = "".join(c for c in account_handle if c.isdigit() or c == "+")
        return f"tel:{clean_number}"

    def get_ui_meta(self) -> Dict[str, Any]:
        return {
            "icon": "phone_in_talk",
            "theme_color": "#ff5733",
            "btn_label": "Lancer Appel / SMS Immédiat",
            "btn_class": "bg-primary-container text-on-primary-container shadow-primary-container/20",
        }
