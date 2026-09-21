import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class StoreChannel(Base):
    __tablename__ = "store_channels"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    channel_type = Column(String(50), nullable=False) # WHATSAPP, MESSENGER, TIKTOK, CALL
    display_title = Column(String(100), nullable=False) # e.g. "WhatsApp Direct", "Messenger", "TikTok Message", "Appel / SMS Direct"
    badge_text = Column(String(50), nullable=True) # e.g. "RECOMMANDÉ", "Page Officielle", "@awachic"
    badge_style = Column(String(50), nullable=True) # color/style indicator
    account_handle = Column(String(150), nullable=False) # e.g. "2250700000000", "awachic", "@awachic", "+225 07 00 11 22 33"
    subtitle = Column(String(200), nullable=True) # e.g. "Réponse moyenne en < 3 minutes", "Discussion avec la créatrice"
    icon_name = Column(String(50), default="chat")
    theme_color = Column(String(20), default="#25D366") # brand color
    is_active = Column(Boolean, default=True)
    is_recommended = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="channels")
    order_intents = relationship("OrderIntent", back_populates="channel")
