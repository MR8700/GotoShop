from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.store_service import StoreService
from app.schemas.store import StoreDetailSchema, StoreUpdateSchema, LoyaltyTierSchema, LoyaltyTierCreateUpdate

router = APIRouter(prefix="/store", tags=["Store"])

@router.get("", response_model=StoreDetailSchema)
def get_current_store(
    request: Request,
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique non configurée")
    return store

@router.get("/list/public")
def list_public_stores(db: Session = Depends(get_db)):
    return StoreService.get_public_stores(db)

@router.put("/{store_id}", response_model=StoreDetailSchema)
def update_store(store_id: str, data: StoreUpdateSchema, db: Session = Depends(get_db)):
    store = StoreService.update_store(db, store_id, data)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return store

@router.get("/{store_id}/loyalty-tiers", response_model=List[LoyaltyTierSchema])
def list_loyalty_tiers(store_id: str, db: Session = Depends(get_db)):
    return StoreService.get_loyalty_tiers(db, store_id)

@router.post("/{store_id}/loyalty-tiers", response_model=LoyaltyTierSchema)
def create_loyalty_tier(store_id: str, data: LoyaltyTierCreateUpdate, db: Session = Depends(get_db)):
    tier = StoreService.create_or_update_loyalty_tier(db, store_id, data)
    return tier

@router.put("/{store_id}/loyalty-tiers/{tier_id}", response_model=LoyaltyTierSchema)
def update_loyalty_tier(store_id: str, tier_id: str, data: LoyaltyTierCreateUpdate, db: Session = Depends(get_db)):
    tier = StoreService.create_or_update_loyalty_tier(db, store_id, data, tier_id=tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Palier introuvable")
    return tier

@router.delete("/{store_id}/loyalty-tiers/{tier_id}")
def delete_loyalty_tier(store_id: str, tier_id: str, db: Session = Depends(get_db)):
    ok = StoreService.delete_loyalty_tier(db, store_id, tier_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Palier introuvable")
    return {"success": True, "message": "Palier de fidélité supprimé"}
