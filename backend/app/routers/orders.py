from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService
from app.services.media_service import MediaService

router = APIRouter(prefix="/orders", tags=["Conversational Orders"])

class OrderItemSchema(BaseModel):
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    product_name: Optional[str] = None
    variant_name: Optional[str] = None
    quantity: int = 1
    unit_price: int = 0
    customization_text: Optional[str] = None
    customization_options: Optional[Any] = None

class OrderDeliverySchema(BaseModel):
    delivery_mode: str = "GPS_AND_DESCRIPTION" # EXACT_GPS, ADDRESS_DESCRIPTION, GPS_AND_DESCRIPTION
    delivery_city: str = "Kossodo (Ouagadougou)"
    delivery_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    delivery_notes: Optional[str] = None

class CreateOrderRequest(BaseModel):
    store_id: str
    items: List[OrderItemSchema]
    delivery: OrderDeliverySchema
    customer_name: str
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_id: Optional[str] = None
    customer_token: Optional[str] = None
    delivery_fee: int = 500
    notes: Optional[str] = None

class AcceptOrderRequest(BaseModel):
    seller_name: Optional[str] = "Commerçant"

class RejectOrderRequest(BaseModel):
    reason: Optional[str] = "Indisponible temporairement"
    seller_name: Optional[str] = "Commerçant"

class ConfirmPaymentRequest(BaseModel):
    verified_by: Optional[str] = "Commerçant"
    verification_note: Optional[str] = None

class RejectPaymentRequest(BaseModel):
    reason: str = "Preuve de paiement illisible ou montant incorrect"
    verified_by: Optional[str] = "Commerçant"

class UpdateOrderStatusRequest(BaseModel):
    status: str # PREPARING, READY_FOR_DELIVERY, OUT_FOR_DELIVERY, DELIVERED, COMPLETED
    notes: Optional[str] = None
    actor_name: Optional[str] = "Commerçant"

class SubmitPaymentProofRequest(BaseModel):
    file_url: str
    file_name: str
    file_size: int
    mime_type: Optional[str] = "image/jpeg"
    customer_note: Optional[str] = None
    sender_id: Optional[str] = None
    sender_name: Optional[str] = "Client"


@router.post("", summary="Créer une commande avec personnalisations et géolocalisation")
def create_order(req: CreateOrderRequest, db: Session = Depends(get_db)):
    try:
        items_data = [item.model_dump() for item in req.items]
        delivery_data = req.delivery.model_dump()
        result = OrderService.create_order(
            db=db,
            store_id=req.store_id,
            items_data=items_data,
            delivery_data=delivery_data,
            customer_name=req.customer_name,
            customer_phone=req.customer_phone,
            customer_email=req.customer_email,
            customer_id=req.customer_id,
            customer_token=req.customer_token,
            delivery_fee=req.delivery_fee,
            notes=req.notes
        )
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", summary="Lister les commandes (filtrage boutique ou client)")
def list_orders(
    store_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    customer_token: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return OrderService.list_orders(
        db=db,
        store_id=store_id,
        customer_id=customer_id,
        customer_token=customer_token,
        status=status
    )


@router.get("/{order_id}", summary="Détail complet d'une commande")
def get_order(order_id: str, db: Session = Depends(get_db)):
    res = OrderService.get_order_by_id(db=db, order_id=order_id)
    if not res:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return res


@router.post("/{order_id}/accept", summary="Accepter une commande (vendeur)")
def accept_order(order_id: str, req: AcceptOrderRequest, db: Session = Depends(get_db)):
    try:
        return OrderService.accept_order(db=db, order_id=order_id, seller_name=req.seller_name or "Commerçant")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/reject", summary="Refuser une commande (vendeur)")
def reject_order(order_id: str, req: RejectOrderRequest, db: Session = Depends(get_db)):
    try:
        return OrderService.reject_order(db=db, order_id=order_id, reason=req.reason, seller_name=req.seller_name or "Commerçant")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/payment-proof", summary="Soumettre une preuve de paiement (client)")
def submit_payment_proof(order_id: str, req: SubmitPaymentProofRequest, db: Session = Depends(get_db)):
    try:
        return PaymentService.submit_payment_proof(
            db=db,
            order_id=order_id,
            file_url=req.file_url,
            file_name=req.file_name,
            file_size=req.file_size,
            mime_type=req.mime_type or "image/jpeg",
            customer_note=req.customer_note,
            sender_id=req.sender_id,
            sender_name=req.sender_name or "Client"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/payment-proof-upload", summary="Téléverser directement et soumettre une preuve de paiement")
async def upload_payment_proof(
    order_id: str,
    file: UploadFile = File(...),
    customer_note: Optional[str] = Form(None),
    sender_id: Optional[str] = Form(None),
    sender_name: Optional[str] = Form("Client"),
    db: Session = Depends(get_db)
):
    try:
        media_res = await MediaService.save_upload_file(
            db=db,
            upload_file=file,
            owner_id=sender_id,
            is_secure_access=True
        )
        proof_res = PaymentService.submit_payment_proof(
            db=db,
            order_id=order_id,
            file_url=media_res["file_url"],
            file_name=media_res["file_name"],
            file_size=media_res["file_size"],
            mime_type=media_res["mime_type"],
            customer_note=customer_note,
            sender_id=sender_id,
            sender_name=sender_name or "Client"
        )
        return {**proof_res, "media": media_res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/confirm-payment", summary="Confirmer la réception du paiement (vendeur)")
def confirm_payment(order_id: str, req: ConfirmPaymentRequest, db: Session = Depends(get_db)):
    try:
        return PaymentService.confirm_payment(
            db=db,
            order_id=order_id,
            verified_by=req.verified_by or "Commerçant",
            verification_note=req.verification_note
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/reject-payment", summary="Signaler un problème sur le paiement (vendeur)")
def reject_payment(order_id: str, req: RejectPaymentRequest, db: Session = Depends(get_db)):
    try:
        return PaymentService.reject_payment(
            db=db,
            order_id=order_id,
            reason=req.reason,
            verified_by=req.verified_by or "Commerçant"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/status", summary="Mettre à jour le statut de préparation / livraison")
def update_status(order_id: str, req: UpdateOrderStatusRequest, db: Session = Depends(get_db)):
    try:
        return OrderService.update_order_status(
            db=db,
            order_id=order_id,
            new_status=req.status,
            notes=req.notes,
            actor_name=req.actor_name or "Commerçant"
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
