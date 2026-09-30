from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.services.notification_engine import NotificationEngine
from app.services.store_service import StoreService
from app.models.notifications import AppNotification, StoreNotification
from app.models.store import Store
from app.routers.auth import get_merchant_principal, assert_store_access

router = APIRouter(prefix="/notifications", tags=["Centralized Notifications & Decision Support"])


def _actor(db: Session, authorization: Optional[str]):
    """Returns ("merchant", principal) or ("customer", customer); 401 otherwise."""
    from app.routers.auth import extract_token
    from app.routers.auth import get_merchant_principal
    from app.services.customer_service import CustomerService
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentification requise.")
    try:
        return "merchant", get_merchant_principal(authorization, db)
    except HTTPException:
        pass
    customer = CustomerService.get_by_token(db, token)
    if not customer:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée.")
    return "customer", customer


def _owned_ids(principal) -> set:
    from app.models.super_admin import SuperAdmin
    if isinstance(principal, SuperAdmin):
        return set()
    return {str(s.id) for s in (principal.stores or [])}


def _can_touch(db: Session, actor, n) -> bool:
    from app.models.super_admin import SuperAdmin
    kind, who = actor
    if kind == "customer":
        return n.recipient_type == "CUSTOMER" and str(n.recipient_id) == str(who.id)
    if isinstance(who, SuperAdmin):
        return True
    ids = _owned_ids(who)
    return str(n.store_id) in ids or str(n.recipient_id) in ids


@router.get("", summary="Lister les notifications centralisées (client ou commerçant)")
def list_notifications(
    recipient_type: Optional[str] = Query(None),  # "STORE_OWNER", "CUSTOMER", "GUEST"
    recipient_id: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # Normalize if called directly outside FastAPI request cycle
    if not isinstance(recipient_type, str): recipient_type = None
    if not isinstance(recipient_id, str): recipient_id = None
    if not isinstance(store_id, str): store_id = None
    if not isinstance(category, str): category = None
    if not isinstance(limit, int): limit = 50

    kind, who = _actor(db, authorization)
    query = db.query(AppNotification)

    from app.routers.auth import assert_store_access
    if kind == "customer":
        # A customer only ever sees their own notifications.
        recipient_type, recipient_id, store_id = "CUSTOMER", str(who.id), None
    else:
        if store_id:
            resolved = StoreService.resolve_store(db, slug=store_id)
            assert_store_access(who, resolved.id if resolved else store_id)
        elif recipient_id:
            assert_store_access(who, recipient_id)
        else:
            from app.models.super_admin import SuperAdmin
            if not isinstance(who, SuperAdmin):
                raise HTTPException(status_code=400, detail="store_id requis.")

    # Determine recipient filters
    if recipient_type and recipient_id:
        query = query.filter(
            AppNotification.recipient_type == recipient_type,
            AppNotification.recipient_id == recipient_id
        )
    elif store_id:
        resolved_store = StoreService.resolve_store(db, slug=store_id)
        target_store_id = resolved_store.id if resolved_store else store_id
        if recipient_type == "STORE_OWNER":
            query = query.filter(
                AppNotification.recipient_type == "STORE_OWNER",
                (AppNotification.recipient_id == target_store_id) | (AppNotification.store_id == target_store_id)
            )
        else:
            query = query.filter(AppNotification.store_id == target_store_id)
    elif recipient_type:
        query = query.filter(AppNotification.recipient_type == recipient_type)
    elif recipient_id:
        query = query.filter(AppNotification.recipient_id == recipient_id)

    if category:
        query = query.filter(AppNotification.category == category)

    total_unread = query.filter(AppNotification.is_read == False).count()
    notifs = query.order_by(
        AppNotification.is_read.asc(),
        desc(AppNotification.created_at)
    ).limit(limit).all()

    formatted = [
        {
            "id": n.id,
            "recipient_type": n.recipient_type,
            "recipient_id": n.recipient_id,
            "store_id": n.store_id,
            "order_id": n.order_id,
            "conversation_id": n.conversation_id,
            "category": n.category,
            "event_type": n.event_type,
            "title": n.title,
            "message": n.message,
            "urgency": n.urgency,
            "action_url": n.action_url,
            "action_label": n.action_label,
            "action_payload": n.action_payload,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]

    return {
        "unread_count": total_unread,
        "discrepancies_count": 0,
        "notifications": formatted
    }


@router.post("/{notification_id}/read", summary="Marquer une notification comme lue")
def mark_read(notification_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    actor = _actor(db, authorization)
    notif = db.query(AppNotification).filter(AppNotification.id == notification_id).first()
    if not notif:
        # Fallback to legacy StoreNotification if present
        legacy = db.query(StoreNotification).filter(StoreNotification.id == notification_id).first()
        if legacy:
            from app.routers.auth import assert_store_access
            if actor[0] != "merchant":
                raise HTTPException(status_code=403, detail="Accès interdit.")
            assert_store_access(actor[1], getattr(legacy, "store_id", None))
            legacy.is_read = True
            db.commit()
            return {"success": True, "id": notification_id}
        raise HTTPException(status_code=404, detail="Notification introuvable")

    if not _can_touch(db, actor, notif):
        raise HTTPException(status_code=403, detail="Accès interdit.")
    notif.is_read = True
    db.commit()
    return {"success": True, "id": notification_id}


@router.post("/read-all", summary="Tout marquer comme lu pour un destinataire")
def mark_all_read(
    recipient_type: Optional[str] = Query(None),
    recipient_id: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    kind, who = _actor(db, authorization)
    from app.routers.auth import assert_store_access
    if kind == "customer":
        recipient_type, recipient_id, store_id = "CUSTOMER", str(who.id), None
    elif store_id:
        r = StoreService.resolve_store(db, slug=store_id)
        assert_store_access(who, r.id if r else store_id)
    elif recipient_id:
        assert_store_access(who, recipient_id)
    else:
        from app.models.super_admin import SuperAdmin
        if not isinstance(who, SuperAdmin):
            raise HTTPException(status_code=400, detail="store_id requis.")
    query = db.query(AppNotification).filter(AppNotification.is_read == False)

    if recipient_type and recipient_id:
        query = query.filter(
            AppNotification.recipient_type == recipient_type,
            AppNotification.recipient_id == recipient_id
        )
    elif store_id:
        resolved = StoreService.resolve_store(db, slug=store_id)
        target = resolved.id if resolved else store_id
        query = query.filter(
            (AppNotification.recipient_id == target) | (AppNotification.store_id == target)
        )

    count = query.update({"is_read": True}, synchronize_session=False)
    db.commit()
    return {"success": True, "count": count}


@router.delete("/{notification_id}", summary="Supprimer une notification")
def delete_notification(notification_id: str, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    actor = _actor(db, authorization)
    notif = db.query(AppNotification).filter(AppNotification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    if not _can_touch(db, actor, notif):
        raise HTTPException(status_code=403, detail="Accès interdit.")
    db.delete(notif)
    db.commit()
    return {"success": True, "id": notification_id}


@router.get("/decision-insights/{store_id}", summary="Obtenir les aides à la décision contextuelles pour le commerçant")
def get_decision_insights(store_id: str, db: Session = Depends(get_db), principal=Depends(get_merchant_principal)):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    assert_store_access(principal, store.id)

    insights = NotificationEngine.get_merchant_decision_insights(db, store)
    return {
        "store_id": store.id,
        "store_slug": store.slug,
        "insights": insights
    }
