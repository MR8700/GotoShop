from typing import Dict
from app.adapters.base import BaseChannelAdapter
from app.adapters.whatsapp import WhatsAppAdapter
from app.adapters.messenger import MessengerAdapter
from app.adapters.tiktok import TikTokAdapter
from app.adapters.call import CallAdapter
from app.adapters.sms import SMSAdapter

_ADAPTERS: Dict[str, BaseChannelAdapter] = {
    "WHATSAPP": WhatsAppAdapter(),
    "MESSENGER": MessengerAdapter(),
    "TIKTOK": TikTokAdapter(),
    "CALL": CallAdapter(),
    "SMS": SMSAdapter(),
}

def get_channel_adapter(channel_type: str) -> BaseChannelAdapter:
    normalized = channel_type.upper()
    adapter = _ADAPTERS.get(normalized)
    if not adapter:
        return _ADAPTERS["WHATSAPP"]
    return adapter
