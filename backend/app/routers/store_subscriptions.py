import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.store import Store, StoreSubscription, StoreAccessHistory, StoreAnnouncement
from app.models.customer import Customer
from app.services.store_service import StoreService
from app.services.notification_engine import NotificationEngine

router = APIRouter(tags=["Store Subscriptions & Mes Boutiques"])

STORE_RECENT_INTERACTION_TTL_DAYS = 30


class SubscribeRequest(BaseModel):
    customer_id: Optional[str] = None
    notification_preferences: Optional[Dict[str, bool]] = None


class CreateAnnouncementRequest(BaseModel):
    title: str
    content: str
    announcement_type: Optional[str] = "NEWS"


def _get_customer_from_request(
    db: Session,
    customer_id: Optional[str] = None,
    authorization: Optional[str] = None
) -> Optional[Customer]:
    if customer_id:
        cust = db.query(Customer).filter(Customer.id == customer_id).first()
        if cust:
            return cust

    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        cust = db.query(Customer).filter(Customer.session_token == token).first()
        if cust:
            return cust
    return None


@router.post("/stores/{store_id}/subscribe", summary="S'abonner aux actualités d'une boutique")
def subscribe_to_store(
    store_id: str,
    req: SubscribeRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    customer = _get_customer_from_request(db, req.customer_id, authorization)
    if not customer:
        raise HTTPException(status_code=401, detail="Authentification client requise pour s'abonner")

    # Check if subscription already exists
    sub = db.query(StoreSubscription).filter(
        StoreSubscription.store_id == store.id,
        StoreSubscription.customer_id == customer.id
    ).first()

    if sub:
        sub.status = "ACTIVE"
        sub.unsubscribed_at = None
        sub.updated_at = datetime.utcnow()
    else:
        sub = StoreSubscription(
            id=str(uuid.uuid4()),
            store_id=store.id,
            customer_id=customer.id,
            status="ACTIVE",
            subscribed_at=datetime.utcnow()
        )
        db.add(sub)

    # Recalculate followers count
    active_count = db.query(StoreSubscription).filter(
        StoreSubscription.store_id == store.id,
        StoreSubscription.status == "ACTIVE"
    ).count()
    store.followers_count = active_count

    # Also log access history
    history = StoreAccessHistory(
        id=str(uuid.uuid4()),
        store_id=store.id,
        customer_id=customer.id,
        interaction_type="SUBSCRIBE",
        last_interacted_at=datetime.utcnow()
    )
    db.add(history)

    db.commit()

    # Non-intrusive notification to merchant
    try:
        NotificationEngine.notify_new_follower(db, store, customer)
        db.commit()
    except Exception as e:
        print("Notice: notify_new_follower failed:", e)

    return {
        "success": True,
        "status": "ACTIVE",
        "store_id": store.id,
        "store_name": store.name,
        "followers_count": store.followers_count
    }


@router.post("/stores/{store_id}/unsubscribe", summary="Se désabonner d'une boutique")
def unsubscribe_from_store(
    store_id: str,
    req: SubscribeRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    customer = _get_customer_from_request(db, req.customer_id, authorization)
    if not customer:
        raise HTTPException(status_code=401, detail="Authentification client requise")

    sub = db.query(StoreSubscription).filter(
        StoreSubscription.store_id == store.id,
        StoreSubscription.customer_id == customer.id
    ).first()

    if sub:
        sub.status = "UNSUBSCRIBED"
        sub.unsubscribed_at = datetime.utcnow()
        sub.updated_at = datetime.utcnow()

    # Recalculate followers count
    active_count = db.query(StoreSubscription).filter(
        StoreSubscription.store_id == store.id,
        StoreSubscription.status == "ACTIVE"
    ).count()
    store.followers_count = active_count

    db.commit()

    return {
        "success": True,
        "status": "UNSUBSCRIBED",
        "store_id": store.id,
        "followers_count": store.followers_count
    }


@router.get("/stores/{store_id}/subscription-status", summary="Vérifier le statut d'abonnement")
def get_subscription_status(
    store_id: str,
    customer_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    customer = _get_customer_from_request(db, customer_id, authorization)
    is_subscribed = False

    if customer:
        sub = db.query(StoreSubscription).filter(
            StoreSubscription.store_id == store.id,
            StoreSubscription.customer_id == customer.id,
            StoreSubscription.status == "ACTIVE"
        ).first()
        is_subscribed = bool(sub)

    return {
        "store_id": store.id,
        "is_subscribed": is_subscribed,
        "followers_count": store.followers_count or 0
    }


@router.get("/customer/my-stores", summary="Obtenir les boutiques suivies et accès récents du client")
def get_my_stores(
    customer_id: Optional[str] = Query(None),
    guest_token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    customer = _get_customer_from_request(db, customer_id, authorization)
    actual_customer_id = customer.id if customer else None

    subscribed_stores = []
    if actual_customer_id:
        active_subs = db.query(StoreSubscription).filter(
            StoreSubscription.customer_id == actual_customer_id,
            StoreSubscription.status == "ACTIVE"
        ).order_by(desc(StoreSubscription.subscribed_at)).all()

        for sub in active_subs:
            st = db.query(Store).filter(Store.id == sub.store_id).first()
            if st and st.is_active:
                subscribed_stores.append({
                    "id": st.id,
                    "slug": st.slug,
                    "name": st.name,
                    "tagline": st.tagline,
                    "logo_url": st.logo_url,
                    "banner_url": st.banner_url,
                    "country": st.country,
                    "delivery_city": st.delivery_city,
                    "rating": st.rating,
                    "review_count": st.review_count,
                    "subscribed_at": sub.subscribed_at.isoformat() if sub.subscribed_at else None,
                })

    # Recent interactions with TTL (30 days)
    ttl_threshold = datetime.utcnow() - timedelta(days=STORE_RECENT_INTERACTION_TTL_DAYS)
    recent_query = db.query(StoreAccessHistory).filter(
        StoreAccessHistory.last_interacted_at >= ttl_threshold
    )

    if actual_customer_id:
        recent_query = recent_query.filter(
            (StoreAccessHistory.customer_id == actual_customer_id) |
            (StoreAccessHistory.guest_token == guest_token)
        )
    elif guest_token:
        recent_query = recent_query.filter(StoreAccessHistory.guest_token == guest_token)
    else:
        recent_query = None

    recent_stores = []
    seen_store_ids = set()
    if recent_query:
        history_records = recent_query.order_by(desc(StoreAccessHistory.last_interacted_at)).limit(20).all()
        for rec in history_records:
            if rec.store_id in seen_store_ids:
                continue
            seen_store_ids.add(rec.store_id)
            st = db.query(Store).filter(Store.id == rec.store_id).first()
            if st and st.is_active:
                recent_stores.append({
                    "id": st.id,
                    "slug": st.slug,
                    "name": st.name,
                    "tagline": st.tagline,
                    "logo_url": st.logo_url,
                    "country": st.country,
                    "delivery_city": st.delivery_city,
                    "rating": st.rating,
                    "last_interacted_at": rec.last_interacted_at.isoformat() if rec.last_interacted_at else None,
                    "interaction_type": rec.interaction_type,
                })

    return {
        "subscribed_stores": subscribed_stores,
        "recent_stores": recent_stores,
        "ttl_days": STORE_RECENT_INTERACTION_TTL_DAYS
    }


@router.post("/stores/{store_id}/announcements", summary="Publier une annonce / actualité boutique")
def create_announcement(
    store_id: str,
    req: CreateAnnouncementRequest,
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    ann = StoreAnnouncement(
        id=str(uuid.uuid4()),
        store_id=store.id,
        title=req.title,
        content=req.content,
        announcement_type=req.announcement_type or "NEWS",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db.add(ann)
    db.commit()
    db.refresh(ann)

    # Broadcast to all active subscribers via NotificationEngine
    try:
        NotificationEngine.notify_store_announcement(db, store, ann.title, ann.content)
        db.commit()
    except Exception as e:
        print("Notice: Announcement notification dispatch failed:", e)

    return {
        "id": ann.id,
        "title": ann.title,
        "content": ann.content,
        "announcement_type": ann.announcement_type,
        "created_at": ann.created_at.isoformat()
    }


@router.get("/stores/{store_id}/announcements", summary="Lister les annonces publiques de la boutique")
def list_announcements(store_id: str, db: Session = Depends(get_db)):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    announcements = db.query(StoreAnnouncement).filter(
        StoreAnnouncement.store_id == store.id,
        StoreAnnouncement.is_active == True
    ).order_by(desc(StoreAnnouncement.created_at)).limit(10).all()

    return [
        {
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "announcement_type": a.announcement_type,
            "created_at": a.created_at.isoformat()
        }
        for a in announcements
    ]
