import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.store_service import StoreService
from app.services.qr_service import QRService
from app.models.store import StoreAccessHistory

router = APIRouter(prefix="/stores/{store_id}/qr", tags=["Store QR Codes & Printing"])


@router.get("", summary="Générer les informations et le QR code vectoriel d'une boutique")
def get_store_qr_code(
    store_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    base_url = str(request.base_url).rstrip("/")
    # If on localhost, use standard origin
    if "127.0.0.1" in base_url or "localhost" in base_url:
        base_url = "http://localhost:5173"

    qr_data = QRService.get_store_qr(store, base_url=base_url)
    return qr_data


@router.get("/svg", summary="Télécharger le fichier SVG brut du QR code")
def download_store_qr_svg(
    store_id: str,
    request: Request,
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    base_url = str(request.base_url).rstrip("/")
    qr_data = QRService.get_store_qr(store, base_url=base_url)

    headers = {
        "Content-Disposition": f'attachment; filename="qr-{store.slug}.svg"'
    }
    return Response(content=qr_data["qr_svg"], media_type="image/svg+xml", headers=headers)


@router.post("/scan", summary="Enregistrer un scan de QR code (accès libre sans barrière)")
def track_qr_scan(
    store_id: str,
    customer_id: Optional[str] = Query(None),
    guest_token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    store = StoreService.resolve_store(db, slug=store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    # Record scan touchpoint
    history = StoreAccessHistory(
        id=str(uuid.uuid4()),
        store_id=store.id,
        customer_id=customer_id,
        guest_token=guest_token,
        interaction_type="QR_SCAN",
        last_interacted_at=datetime.utcnow()
    )
    db.add(history)
    db.commit()

    return {"success": True, "store_slug": store.slug, "store_name": store.name}
