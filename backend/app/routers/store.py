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
from app.core.clock import utcnow

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
    store.owner_last_seen_at = utcnow()
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
        store.owner_last_seen_at = utcnow()
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


# --- Tarifs de livraison par ville (saisie commerçant) -----------------------------------------------------------
from pydantic import BaseModel, Field
from app.models.store import DeliveryCity
from app.services.geo_service import (DEFAULT_DELIVERY_FEE, suggest_gps, check_location, alert_message,
                                       valid_coords as geo_valid)


class DeliveryCityPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    display_label: Optional[str] = Field(None, max_length=100)
    delivery_fee: Optional[int] = Field(None, ge=0, le=1_000_000)  # None -> tarif par défaut : jamais de zone sans tarif
    is_default: Optional[bool] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    radius_km: Optional[float] = Field(None, gt=0, le=500)


class LocationCheckPayload(BaseModel):
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def _city_dict(c: DeliveryCity):
    return {"id": c.id, "name": c.name, "display_label": c.display_label, "is_default": bool(c.is_default),
            "display_order": c.display_order or 0, "delivery_fee": c.delivery_fee,
            "latitude": c.latitude, "longitude": c.longitude, "radius_km": c.radius_km,
            "has_gps": geo_valid(c.latitude, c.longitude)}


def _apply_city_fields(city: DeliveryCity, data: DeliveryCityPayload):
    """Tarif toujours renseigné ; GPS fourni, sinon référence connue pour le nom de la ville."""
    city.delivery_fee = DEFAULT_DELIVERY_FEE if data.delivery_fee is None else data.delivery_fee
    if (data.latitude is None) != (data.longitude is None):
        raise HTTPException(status_code=400, detail="Renseignez la latitude ET la longitude de la ville.")
    if data.latitude is not None:
        city.latitude, city.longitude = data.latitude, data.longitude
        city.radius_km = data.radius_km or city.radius_km or 15.0
    else:
        ref = suggest_gps(city.name)
        if ref and (city.latitude is None or city.longitude is None):
            city.latitude, city.longitude, city.radius_km = ref["latitude"], ref["longitude"], data.radius_km or ref["radius_km"]
        elif data.radius_km:
            city.radius_km = data.radius_km


def _resolve_store_id(db: Session, store_id: str) -> str:
    store = StoreService.resolve_store(db, slug=store_id) or db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return store.id


def _apply_default(db: Session, sid: str, keep_id: str):
    db.query(DeliveryCity).filter(DeliveryCity.store_id == sid, DeliveryCity.id != keep_id).update({"is_default": False})


@router.post("/{store_id}/delivery-check", summary="Vérifier la position du client par rapport aux villes livrées")
def check_delivery_location(store_id: str, data: LocationCheckPayload, db: Session = Depends(get_db)):
    sid = _resolve_store_id(db, store_id)
    cities = db.query(DeliveryCity).filter(DeliveryCity.store_id == sid).all()
    res = check_location(cities, data.city, data.latitude, data.longitude)
    res["message"] = alert_message(res, data.city)
    return res


@router.get("/{store_id}/delivery-cities", summary="Villes de livraison et tarifs")
def list_delivery_cities(store_id: str, db: Session = Depends(get_db)):
    sid = _resolve_store_id(db, store_id)
    rows = db.query(DeliveryCity).filter(DeliveryCity.store_id == sid).order_by(DeliveryCity.display_order, DeliveryCity.name).all()
    return [_city_dict(c) for c in rows]


@router.post("/{store_id}/delivery-cities", summary="Ajouter une ville de livraison")
def create_delivery_city(store_id: str, data: DeliveryCityPayload, authorization: Optional[str] = Header(None),
                         db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    name = data.name.strip()
    if db.query(DeliveryCity).filter(DeliveryCity.store_id == sid, DeliveryCity.name.ilike(name)).first():
        raise HTTPException(status_code=400, detail="Cette ville existe déjà pour la boutique.")
    count = db.query(DeliveryCity).filter(DeliveryCity.store_id == sid).count()
    city = DeliveryCity(store_id=sid, name=name, display_label=(data.display_label or name).strip(),
                        is_default=bool(data.is_default) or count == 0, display_order=count)
    _apply_city_fields(city, data)
    db.add(city)
    db.flush()
    if city.is_default:
        _apply_default(db, sid, city.id)
    db.commit()
    return _city_dict(city)


@router.put("/{store_id}/delivery-cities/{city_id}", summary="Modifier une ville / son tarif")
def update_delivery_city(store_id: str, city_id: str, data: DeliveryCityPayload, authorization: Optional[str] = Header(None),
                         db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    city = db.query(DeliveryCity).filter(DeliveryCity.id == city_id, DeliveryCity.store_id == sid).first()
    if not city:
        raise HTTPException(status_code=404, detail="Ville introuvable")
    name = data.name.strip()
    dup = db.query(DeliveryCity).filter(DeliveryCity.store_id == sid, DeliveryCity.name.ilike(name), DeliveryCity.id != city_id).first()
    if dup:
        raise HTTPException(status_code=400, detail="Cette ville existe déjà pour la boutique.")
    city.name = name
    city.display_label = (data.display_label or name).strip()
    _apply_city_fields(city, data)
    if data.is_default:
        city.is_default = True
        _apply_default(db, sid, city.id)
    db.commit()
    return _city_dict(city)


@router.delete("/{store_id}/delivery-cities/{city_id}", summary="Supprimer une ville de livraison")
def delete_delivery_city(store_id: str, city_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    city = db.query(DeliveryCity).filter(DeliveryCity.id == city_id, DeliveryCity.store_id == sid).first()
    if not city:
        raise HTTPException(status_code=404, detail="Ville introuvable")
    was_default = bool(city.is_default)
    db.delete(city)
    db.flush()
    if was_default:
        nxt = db.query(DeliveryCity).filter(DeliveryCity.store_id == sid).order_by(DeliveryCity.display_order).first()
        if nxt:
            nxt.is_default = True
    db.commit()
    return {"success": True}


# --- Lieux de retrait et de livraison (saisie commerçant) ------------------------------------------------------
from app.models.store import DeliverySpot
from app.services.delivery_spot_service import spot_to_dict, store_images
import json as _json


class DeliverySpotPayload(BaseModel):
    kind: str = Field("PICKUP", pattern="^(PICKUP|DELIVERY)$")
    name: str = Field(..., min_length=2, max_length=120)
    city: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=1000)
    hours: Optional[str] = Field(None, max_length=300)
    images: Optional[List[str]] = None  # URLs conservées + nouvelles images en data URI base64
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    delivery_fee: Optional[int] = Field(None, ge=0, le=1_000_000)
    is_active: Optional[bool] = True


def _spot_gps_check(db: Session, spot: DeliverySpot) -> dict:
    """Compare la position saisie du lieu à la zone (ville) choisie. Non bloquant : renvoie une alerte."""
    if spot.latitude is None or spot.longitude is None:
        return {"status": "NO_GPS", "message": None}
    cities = db.query(DeliveryCity).filter(DeliveryCity.store_id == spot.store_id).all()
    res = check_location(cities, spot.city, spot.latitude, spot.longitude)
    msg = alert_message(res, spot.city)
    res["message"] = msg.replace("Votre position GPS", "La position de ce lieu") if msg else None
    return res


def _spot_response(db: Session, spot: DeliverySpot) -> dict:
    out = spot_to_dict(spot)
    out["gps_check"] = _spot_gps_check(db, spot)
    return out


def _apply_spot(spot: DeliverySpot, data: DeliverySpotPayload):
    spot.kind = data.kind
    spot.name = data.name.strip()
    spot.city = (data.city or "").strip() or None
    spot.address = (data.address or "").strip() or None
    spot.description = (data.description or "").strip() or None
    spot.hours = (data.hours or "").strip() or None
    if (data.latitude is None) != (data.longitude is None):
        raise ValueError("Renseignez la latitude ET la longitude (ou aucune des deux).")
    spot.latitude, spot.longitude = data.latitude, data.longitude
    spot.delivery_fee = 0 if data.kind == "PICKUP" else data.delivery_fee
    spot.is_active = True if data.is_active is None else bool(data.is_active)
    if data.images is not None:
        spot.image_urls = _json.dumps(store_images(data.images), ensure_ascii=False)


@router.get("/{store_id}/delivery-spots", summary="Lieux de retrait / livraison de la boutique")
def list_delivery_spots(store_id: str, all: bool = Query(False), authorization: Optional[str] = Header(None),
                        db: Session = Depends(get_db)):
    sid = _resolve_store_id(db, store_id)
    q = db.query(DeliverySpot).filter(DeliverySpot.store_id == sid)
    if all:
        require_store_admin(store_id, authorization, db)  # le commerçant voit aussi les lieux désactivés
    else:
        q = q.filter(DeliverySpot.is_active == True)
    return [spot_to_dict(s) for s in q.order_by(DeliverySpot.display_order, DeliverySpot.name).all()]


@router.post("/{store_id}/delivery-spots", summary="Ajouter un lieu de retrait / livraison")
def create_delivery_spot(store_id: str, data: DeliverySpotPayload, authorization: Optional[str] = Header(None),
                         db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    spot = DeliverySpot(store_id=sid, display_order=db.query(DeliverySpot).filter(DeliverySpot.store_id == sid).count())
    try:
        _apply_spot(spot, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.add(spot)
    db.commit()
    return _spot_response(db, spot)


@router.put("/{store_id}/delivery-spots/{spot_id}", summary="Modifier un lieu de retrait / livraison")
def update_delivery_spot(store_id: str, spot_id: str, data: DeliverySpotPayload, authorization: Optional[str] = Header(None),
                         db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    spot = db.query(DeliverySpot).filter(DeliverySpot.id == spot_id, DeliverySpot.store_id == sid).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    try:
        _apply_spot(spot, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    db.commit()
    return _spot_response(db, spot)


@router.delete("/{store_id}/delivery-spots/{spot_id}", summary="Supprimer un lieu de retrait / livraison")
def delete_delivery_spot(store_id: str, spot_id: str, authorization: Optional[str] = Header(None),
                         db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    spot = db.query(DeliverySpot).filter(DeliverySpot.id == spot_id, DeliverySpot.store_id == sid).first()
    if not spot:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    db.delete(spot)  # les commandes existantes gardent leur copie figée du lieu (spot_snapshot)
    db.commit()
    return {"success": True}


# --- Remises boutique (saisie commerçant) --------------------------------------------------------------------------
from app.models.store import StoreDiscountRule


class DiscountRulePayload(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    percent: int = Field(..., ge=1, le=100)
    audience: str = "ALL"  # ALL | CLIENTS | VISITORS | SELECTED
    customer_ids: Optional[List[str]] = None
    scope: str = "STORE"  # STORE | PRODUCT | CATEGORY
    product_ids: Optional[List[str]] = None
    category_ids: Optional[List[str]] = None
    min_order_amount: Optional[int] = Field(0, ge=0)
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    is_active: Optional[bool] = True


@router.get("/{store_id}/discount-rules", summary="Remises boutique du commerçant")
def list_discount_rules(store_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    from app.services.discount_service import rule_to_dict
    sid = _resolve_store_id(db, store_id)
    rows = db.query(StoreDiscountRule).filter(StoreDiscountRule.store_id == sid).order_by(StoreDiscountRule.created_at.desc()).all()
    return [rule_to_dict(r) for r in rows]


@router.post("/{store_id}/discount-rules", summary="Créer une remise boutique")
def create_discount_rule(store_id: str, data: DiscountRulePayload, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    from app.services.discount_service import validate_payload, rule_to_dict
    sid = _resolve_store_id(db, store_id)
    try:
        clean = validate_payload(db, sid, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    rule = StoreDiscountRule(store_id=sid, **clean)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule_to_dict(rule)


@router.put("/{store_id}/discount-rules/{rule_id}", summary="Modifier une remise boutique")
def update_discount_rule(store_id: str, rule_id: str, data: DiscountRulePayload, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    from app.services.discount_service import validate_payload, rule_to_dict
    sid = _resolve_store_id(db, store_id)
    rule = db.query(StoreDiscountRule).filter(StoreDiscountRule.id == rule_id, StoreDiscountRule.store_id == sid).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Remise introuvable")
    try:
        clean = validate_payload(db, sid, data.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    for k, v in clean.items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule_to_dict(rule)


@router.delete("/{store_id}/discount-rules/{rule_id}", summary="Supprimer une remise boutique")
def delete_discount_rule(store_id: str, rule_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    sid = _resolve_store_id(db, store_id)
    rule = db.query(StoreDiscountRule).filter(StoreDiscountRule.id == rule_id, StoreDiscountRule.store_id == sid).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Remise introuvable")
    db.delete(rule)
    db.commit()
    return {"success": True}
