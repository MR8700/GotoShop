from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.commerce_service import CommerceService
from app.services.store_service import StoreService
from app.schemas.commerce import (
    CreateIntentRequest,
    IntentResponse,
    ConfirmSaleRequest,
    IntentSummarySchema,
    ClientOrderActionRequest,
    ResolveDiscrepancyRequest,
)
from pydantic import BaseModel

class BatchLookupRequest(BaseModel):
    intent_ids: List[str]

router = APIRouter(prefix="/intents", tags=["Commerce"])

def format_elapsed(dt: datetime) -> str:
    diff = datetime.utcnow() - dt
    total_seconds = int(diff.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    if hours >= 24:
        days = hours // 24
        return f"Il y a {days}j"
    elif hours > 0:
        return f"Il y a {hours}h{minutes:02d}"
    elif minutes > 0:
        return f"Il y a {minutes}m"
    else:
        return "À l'instant"

def map_to_summary(it) -> IntentSummarySchema:
    return IntentSummarySchema(
        id=it.id,
        reference_code=it.reference_code,
        product_name=it.product.name if it.product else "Produit",
        product_image_url=it.product.primary_image_url if it.product else None,
        channel_type=it.channel_type,
        total_amount=it.total_amount,
        currency=it.currency,
        customer_name=it.customer_name,
        customer_phone=it.customer_phone,
        customer_source=it.customer_source,
        customer_location_url=it.customer_location_url,
        customer_coordinates=it.customer_coordinates,
        quantity=it.quantity,
        selected_color=it.selected_color,
        delivery_city=it.delivery_city,
        status=it.status,
        client_status=it.client_status or "PENDING",
        client_feedback=it.client_feedback,
        client_satisfaction_rating=it.client_satisfaction_rating,
        client_action_at=it.client_action_at,
        coherence_status=it.coherence_status or "HARMONIZED_PENDING",
        coherence_notes=it.coherence_notes,
        is_urgent_followup=it.is_urgent_followup,
        is_archived=bool(getattr(it, "is_archived", False)),
        time_elapsed_display=format_elapsed(it.created_at),
        created_at=it.created_at
    )

@router.post("", response_model=IntentResponse)
def create_intent(req: CreateIntentRequest, db: Session = Depends(get_db)):
    try:
        intent, redirect_url, prefilled_msg, token = CommerceService.create_order_intent(db, req)
        return IntentResponse(
            id=intent.id,
            reference_code=intent.reference_code,
            store_id=intent.store_id,
            product_id=intent.product_id,
            channel_type=intent.channel_type,
            quantity=intent.quantity,
            selected_color=intent.selected_color,
            delivery_city=intent.delivery_city,
            customer_location_url=intent.customer_location_url,
            customer_coordinates=intent.customer_coordinates,
            unit_price=intent.unit_price,
            total_amount=intent.total_amount,
            currency=intent.currency,
            status=intent.status,
            client_status=intent.client_status or "PENDING",
            client_feedback=intent.client_feedback,
            client_satisfaction_rating=intent.client_satisfaction_rating,
            client_action_at=intent.client_action_at,
            coherence_status=intent.coherence_status or "HARMONIZED_PENDING",
            coherence_notes=intent.coherence_notes,
            redirect_url=redirect_url,
            prefilled_message=prefilled_msg,
            secure_token=token,
            created_at=intent.created_at,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/pending-followup", response_model=List[IntentSummarySchema])
def list_pending_followups(
    request: Request = None,
    store_slug: Optional[str] = None,
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return []
    intents = CommerceService.get_pending_followups(db, store.id)
    return [map_to_summary(it) for it in intents]

@router.get("/feed", response_model=List[IntentSummarySchema])
def list_intent_feed(
    request: Request = None,
    limit: Optional[int] = None,
    include_archived: bool = False,
    search: Optional[str] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    store_slug: Optional[str] = None,
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    db: Session = Depends(get_db),
):
    slug = x_store_slug or store_slug
    host = request.headers.get("host") if request else None
    store = StoreService.resolve_store(db, slug=slug, host=host)
    if not store:
        return []
    intents = CommerceService.get_intent_feed(
        db,
        store.id,
        limit=limit,
        include_archived=include_archived,
        search=search,
        channel=channel,
        status=status,
    )
    return [map_to_summary(it) for it in intents]

@router.post("/{intent_id}/archive", response_model=IntentSummarySchema)
def archive_intent(intent_id: str, db: Session = Depends(get_db)):
    intent = CommerceService.toggle_archive_intent(db, intent_id)
    if not intent:
        raise HTTPException(status_code=404, detail="Intention introuvable")
    return map_to_summary(intent)

@router.delete("/{intent_id}")
def delete_intent(intent_id: str, db: Session = Depends(get_db)):
    ok = CommerceService.delete_intent(db, intent_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Intention introuvable")
    return {"success": True, "message": "Intention supprimée définitivement"}

@router.get("/discrepancies", response_model=List[IntentSummarySchema])
def list_discrepancies(db: Session = Depends(get_db)):
    store = StoreService.get_default_store(db)
    if not store:
        return []
    intents = CommerceService.get_discrepancies(db, store.id)
    return [map_to_summary(it) for it in intents]

@router.get("/by-reference/{reference_code}", response_model=IntentSummarySchema)
def get_order_by_reference(reference_code: str, db: Session = Depends(get_db)):
    intent = CommerceService.get_by_reference(db, reference_code)
    if not intent:
        raise HTTPException(status_code=404, detail="Commande introuvable avec cette référence")
    return map_to_summary(intent)

@router.post("/batch-lookup", response_model=List[IntentSummarySchema])
def batch_lookup(req: BatchLookupRequest, db: Session = Depends(get_db)):
    intents = CommerceService.get_intents_by_ids(db, req.intent_ids)
    return [map_to_summary(it) for it in intents]

@router.post("/{intent_id}/client-action", response_model=IntentSummarySchema)
def client_order_action(intent_id: str, req: ClientOrderActionRequest, db: Session = Depends(get_db)):
    try:
        intent = CommerceService.record_client_action(
            db=db,
            intent_id_or_ref=intent_id,
            req=req
        )
        return map_to_summary(intent)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{intent_id}/resolve-discrepancy", response_model=IntentSummarySchema)
def resolve_discrepancy(intent_id: str, req: ResolveDiscrepancyRequest, db: Session = Depends(get_db)):
    try:
        intent = CommerceService.resolve_discrepancy(
            db=db,
            intent_id=intent_id,
            req=req
        )
        return map_to_summary(intent)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{intent_id}/confirm")
def confirm_sale(intent_id: str, req: ConfirmSaleRequest, db: Session = Depends(get_db)):
    try:
        intent = CommerceService.confirm_sale(db, intent_id, req)
        return {
            "success": True,
            "status": intent.status,
            "coherence_status": intent.coherence_status,
            "reference_code": intent.reference_code,
            "total_amount": intent.total_amount,
            "currency": intent.currency,
            "message": "Vente conclue et CA actualisé !" if req.is_sold else "Abandon enregistré."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/confirm-by-token/{token}")
def confirm_by_token(token: str, req: ConfirmSaleRequest, db: Session = Depends(get_db)):
    try:
        intent = CommerceService.confirm_by_token(db, token, req.is_sold, req.reason)
        return {
            "success": True,
            "status": intent.status,
            "coherence_status": intent.coherence_status,
            "reference_code": intent.reference_code,
            "total_amount": intent.total_amount,
            "currency": intent.currency,
            "message": "Vente validée avec succès !" if req.is_sold else "Abandon validé."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
