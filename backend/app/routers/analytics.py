from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, Header, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.analytics_service import AnalyticsService
from app.services.store_service import StoreService
from app.schemas.analytics import AnalyticsOverview

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/overview", response_model=AnalyticsOverview)
def get_analytics_overview(
    request: Request,
    period: str = Query("today"),
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique non configurée")
    return AnalyticsService.get_overview(db, store.id, period)

@router.post("/track-visit")
def track_visitor_source(
    request: Request,
    source: str = Query("direct"),
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return {"success": False}
    AnalyticsService.track_visit(db, store.id, source)
    return {"success": True, "source": source}
