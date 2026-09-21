from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseChannelAdapter(ABC):
    @abstractmethod
    def channel_type(self) -> str:
        """Returns the channel identifier, e.g. WHATSAPP, MESSENGER, TIKTOK, CALL"""
        pass

    @abstractmethod
    def format_message(self, context: Dict[str, Any]) -> str:
        """Generates the formatted message text with reference code, product, quantity, city."""
        pass

    @abstractmethod
    def build_redirect_url(self, account_handle: str, context: Dict[str, Any]) -> str:
        """Builds the actual deep link / web redirect URL."""
        pass

    @abstractmethod
    def get_ui_meta(self) -> Dict[str, Any]:
        """Returns UI visual metadata such as brand color, icon, and button label."""
        pass
