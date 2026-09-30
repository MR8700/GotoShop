from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Header, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.analytics_service import AnalyticsService
from app.services.store_service import StoreService
from app.schemas.analytics import AnalyticsOverview
from app.routers.auth import get_merchant_principal, assert_store_access
from app.core.ratelimit import rate_limit

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics_overview(
    request: Request,
    period: str = Query("today"),
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db),
    principal=Depends(get_merchant_principal),
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    from app.models.super_admin import SuperAdmin
    if not slug and not isinstance(principal, SuperAdmin) and principal.stores:
        store = principal.stores[0]
    if not store:
        raise HTTPException(status_code=404, detail="Boutique non configurée")
    assert_store_access(principal, store.id)
    return AnalyticsService.get_overview(db, store.id, period)

@router.post("/track-visit")
def track_visitor_source(
    request: Request,
    source: str = Query("direct"),
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db),
    _rl=Depends(rate_limit("track-visit", 60, 60)),
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return {"success": False}
    AnalyticsService.track_visit(db, store.id, source)
    return {"success": True, "source": source}


# --- Publicité de produit : liens de partage tracés (un par produit et par réseau) ---------------------------------
from app.routers.auth import require_store_admin  # noqa: E402
from app.services.share_ad_service import ShareAdService, NETWORKS  # noqa: E402
from app.models.store import Store  # noqa: E402


def _store_or_404(db: Session, store_ref: str) -> Store:
    store = StoreService.resolve_store(db, slug=store_ref) or db.query(Store).filter(Store.id == store_ref).first()
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return store


class ShareEventPayload(BaseModel):
    code: str = Field(..., min_length=6, max_length=20)
    event: str  # CLICK | VIEW | INTENT
    visitor_id: str = Field(..., min_length=8, max_length=64)


class ShareLinkPayload(BaseModel):
    product_id: str
    network: str = "other"


@router.get("/share-networks", summary="Réseaux proposés pour la publicité produit")
def list_share_networks():
    return [{"id": k, **v} for k, v in NETWORKS.items()]


@router.get("/share-link/{code}", summary="Produit et boutique d'un lien de publicité (public)")
def resolve_share_link(code: str, db: Session = Depends(get_db)):
    info = ShareAdService.resolve(db, code)
    if not info:
        raise HTTPException(status_code=404, detail="Lien inconnu ou désactivé")
    return info


@router.post("/share-event", summary="Enregistrer un clic / une vue / une intention venant d'un lien de publicité (public)")
def record_share_event(payload: ShareEventPayload, db: Session = Depends(get_db)):
    try:
        return ShareAdService.record_event(db, payload.code, payload.event, payload.visitor_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{store_id}/share-links", summary="Créer (ou retrouver) le lien de publicité d'un produit sur un réseau")
def create_share_link(store_id: str, payload: ShareLinkPayload, authorization: Optional[str] = Header(None),
                      db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    store = _store_or_404(db, store_id)
    try:
        link = ShareAdService.get_or_create_link(db, store.id, payload.product_id, payload.network)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ShareAdService.link_to_dict(link)


@router.get("/{store_id}/share-stats", summary="Résultats de la publicité produit (vues, intentions, commandes, achats)")
def share_stats(store_id: str, product_id: Optional[str] = Query(None), days: Optional[int] = Query(None, ge=1, le=730),
                authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    require_store_admin(store_id, authorization, db)
    store = _store_or_404(db, store_id)
    return ShareAdService.stats(db, store.id, product_id, days)


@router.get("/share-page/{code}", response_class=HTMLResponse, summary="Page d'aperçu (image, titre, prix) puis redirection vers la boutique")
def share_page(code: str, request: Request, db: Session = Depends(get_db)):
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "https").split(",")[0].strip()
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc).split(",")[0].strip()
    page = ShareAdService.og_page(db, code, f"{proto}://{host}")
    if page is None:
        raise HTTPException(status_code=404, detail="Lien inconnu ou désactivé")
    return HTMLResponse(page, headers={"Cache-Control": "public, max-age=300"})
