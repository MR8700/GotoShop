from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.notification_service import NotificationService
from app.services.store_service import StoreService
from app.schemas.notifications import NotificationListResponse

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=NotificationListResponse)
def list_notifications(db: Session = Depends(get_db)):
    store = StoreService.get_default_store(db)
    if not store:
        return NotificationListResponse(unread_count=0, discrepancies_count=0, notifications=[])
    return NotificationService.get_notifications(db, store.id)

@router.post("/{notification_id}/read")
def mark_read(notification_id: str, db: Session = Depends(get_db)):
    success = NotificationService.mark_as_read(db, notification_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    return {"success": True, "id": notification_id}

@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    store = StoreService.get_default_store(db)
    if not store:
        return {"success": True, "count": 0}
    count = NotificationService.mark_all_as_read(db, store.id)
    return {"success": True, "count": count}
