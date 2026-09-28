from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.store_service import StoreService
from app.models.store import Store
from app.schemas.store import is_recently_seen
from app.schemas.store import (
    StoreDetailSchema,
    StoreUpdateSchema,
    LoyaltyTierSchema,
    LoyaltyTierCreateUpdate,
    StoreRegisterRequest,
    StoreRegisterResponse,
)

router = APIRouter(prefix="/store", tags=["Store"])

@router.post("/register", response_model=StoreRegisterResponse)
def register_store(data: StoreRegisterRequest, db: Session = Depends(get_db)):
    """Creates and activates a new merchant store immediately with trial and owner session."""
    try:
        return StoreService.register_store(db, data)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la création de la boutique: {str(e)}")


@router.get("", response_model=StoreDetailSchema)
def get_current_store(
    request: Request,
    store_slug: Optional[str] = Query(None, alias="store"),
    slug_param: Optional[str] = Query(None, alias="slug"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug or slug_param
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique non configurée")
    return store

@router.get("/list/public")
def list_public_stores(db: Session = Depends(get_db)):
    return StoreService.get_public_stores(db)

def _strict_owner(store_id: str, authorization: Optional[str], db: Session):
    """Presence/opening can only be changed by a real, authenticated owner (no dev fallback)."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentification requise")
    require_store_admin(store_id, authorization, db)


def _presence_payload(store):
    return {
        "is_open": store.is_open is not False,
        "is_owner_online": is_recently_seen(store.owner_last_seen_at),
        "owner_last_seen_at": store.owner_last_seen_at,
    }


@router.get("/{store_id}/status", summary="Statut public: boutique ouverte / vendeur en ligne")
def get_store_status(store_id: str, db: Session = Depends(get_db)):
    store = StoreService.resolve_store(db, slug=store_id) or db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return _presence_payload(store)


@router.post("/{store_id}/presence", summary="Heartbeat du propriétaire connecté")
def owner_heartbeat(store_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _strict_owner(store_id, authorization, db)
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    store.owner_last_seen_at = datetime.utcnow()
    db.commit()
    return _presence_payload(store)


@router.put("/{store_id}/open", summary="Ouvrir ou fermer la boutique")
def set_store_open(store_id: str, payload: dict, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _strict_owner(store_id, authorization, db)
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    store.is_open = bool(payload.get("is_open", True))
    if store.is_open:
        store.owner_last_seen_at = datetime.utcnow()
    db.commit()
    return _presence_payload(store)


@router.get("/{store_id}/reviews")
def get_store_reviews(store_id: str, db: Session = Depends(get_db)):
    return StoreService.get_store_reviews(db, store_id)

from app.routers.auth import require_store_admin

@router.put("/{store_id}", response_model=StoreDetailSchema)
def update_store(
    store_id: str,
    data: StoreUpdateSchema,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    require_store_admin(store_id, authorization, db)
    store = StoreService.update_store(db, store_id, data)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return store

@router.get("/{store_id}/loyalty-tiers", response_model=List[LoyaltyTierSchema])
def list_loyalty_tiers(store_id: str, db: Session = Depends(get_db)):
    return StoreService.get_loyalty_tiers(db, store_id)

@router.post("/{store_id}/loyalty-tiers", response_model=LoyaltyTierSchema)
def create_loyalty_tier(
    store_id: str,
    data: LoyaltyTierCreateUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    require_store_admin(store_id, authorization, db)
    tier = StoreService.create_or_update_loyalty_tier(db, store_id, data)
    return tier

@router.put("/{store_id}/loyalty-tiers/{tier_id}", response_model=LoyaltyTierSchema)
def update_loyalty_tier(
    store_id: str,
    tier_id: str,
    data: LoyaltyTierCreateUpdate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    require_store_admin(store_id, authorization, db)
    tier = StoreService.create_or_update_loyalty_tier(db, store_id, data, tier_id=tier_id)
    if not tier:
        raise HTTPException(status_code=404, detail="Palier introuvable")
    return tier

@router.delete("/{store_id}/loyalty-tiers/{tier_id}")
def delete_loyalty_tier(
    store_id: str,
    tier_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    require_store_admin(store_id, authorization, db)
    ok = StoreService.delete_loyalty_tier(db, store_id, tier_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Palier introuvable")
    return {"success": True, "message": "Palier de fidélité supprimé"}
