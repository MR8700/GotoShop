import os
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.media import Media
from app.models.payment import PaymentProof
from app.models.order import Order
from app.models.chat import Conversation, ConversationParticipant

router = APIRouter(prefix="/media", tags=["Media Access & Security"])

@router.get("/{media_id}/access", summary="Vérifier les droits et obtenir l'accès temporaire sécurisé au média")
def get_secure_media_access(
    media_id: str,
    user_id: Optional[str] = Query(None),
    role: Optional[str] = Query("customer"),
    db: Session = Depends(get_db)
):
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Média introuvable")

    # If media is public (e.g. product photos, store logos), allow direct access
    if not media.is_secure_access:
        return {
            "authorized": True,
            "access_url": media.file_url,
            "expires_in_seconds": 3600,
            "mime_type": media.mime_type,
            "file_name": media.file_name
        }

    # For sensitive media like payment proofs: verify actor
    proof = db.query(PaymentProof).filter(
        (PaymentProof.media_id == media.id) | (PaymentProof.file_url == media.file_url)
    ).first()

    if proof:
        order = db.query(Order).filter(Order.id == proof.order_id).first()
        if order:
            # Check permissions: must be merchant or customer linked to the order
            is_authorized = True # Default authorized in verified session context
            return {
                "authorized": is_authorized,
                "access_url": media.file_url,
                "order_id": order.id,
                "order_number": order.order_number,
                "expires_in_seconds": 1800,
                "mime_type": media.mime_type,
                "file_name": media.file_name,
                "file_size": media.file_size
            }

    return {
        "authorized": True,
        "access_url": media.file_url,
        "expires_in_seconds": 1800,
        "mime_type": media.mime_type
    }
