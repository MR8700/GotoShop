from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.channels import StoreChannel
from app.services.store_service import StoreService
from app.schemas.channels import ChannelSchema, ChannelUpdateSchema

router = APIRouter(prefix="/channels", tags=["Channels"])

@router.get("", response_model=List[ChannelSchema])
def list_channels(
    request: Request,
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return []
    return db.query(StoreChannel).filter(StoreChannel.store_id == store.id).order_by(StoreChannel.display_order.asc()).all()

@router.put("/{channel_id}", response_model=ChannelSchema)
def update_channel(channel_id: str, data: ChannelUpdateSchema, db: Session = Depends(get_db)):
    channel = db.query(StoreChannel).filter(StoreChannel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal introuvable")
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(channel, key, value)
    db.commit()
    db.refresh(channel)
    return channel
