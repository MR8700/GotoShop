from fastapi import APIRouter, Depends, HTTPException, Header, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator

from app.database import get_db
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService
from app.services.media_service import MediaService
from app.routers.auth import require_store_admin
from app.models.order import Order


def _require_seller(db: Session, order_id: str, authorization: Optional[str]):
    """Seller-only actions: caller must own the store the order belongs to."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    require_store_admin(order.store_id, authorization, db)

router = APIRouter(prefix="/orders", tags=["Conversational Orders"])

class OrderItemSchema(BaseModel):
    product_id: Optional[str] = None
    variant_id: Optional[str] = None
    product_name: Optional[str] = None
    variant_name: Optional[str] = None
    quantity: float = 1.0
    unit_price: Optional[float] = None
    unit: Optional[str] = "PIECE"
    unit_label: Optional[str] = "pièce"
    pricing_model: Optional[str] = "FIXED_PER_UNIT"
    measurements: Optional[Any] = None
    customization_text: Optional[str] = None
    customization_options: Optional[Any] = None

    @field_validator("product_id", "variant_id", mode="before")
    @classmethod
    def clean_ids(cls, v):
        if v is None or not str(v).strip() or str(v).strip().lower() in ["none", "null", "undefined"]:
            return None
        return str(v).strip()

    @field_validator("unit_price", "quantity", mode="before")
    @classmethod
    def parse_numeric(cls, v):
        if v is None or v == "" or str(v).strip().lower() in ["none", "null", "nan"]:
            return 1.0
        try:
            return float(v)
        except (ValueError, TypeError):
            return 1.0

class OrderDeliverySchema(BaseModel):
    delivery_mode: str = "GPS_AND_DESCRIPTION" # EXACT_GPS, ADDRESS_DESCRIPTION, GPS_AND_DESCRIPTION
    delivery_city: str = "Kossodo (Ouagadougou)"
    delivery_address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    location_accuracy: Optional[float] = None
    delivery_notes: Optional[str] = None

    @field_validator("latitude", "longitude", "location_accuracy", mode="before")
    @classmethod
    def parse_coords(cls, v):
        if v is None or v == "" or str(v).strip().lower() in ["none", "null", "nan"]:
            return None
        try:
            return float(v)
        except (ValueError, TypeError):
            return None

class CreateOrderRequest(BaseModel):
    store_id: str
    items: List[OrderItemSchema]
    delivery: OrderDeliverySchema
    customer_name: Optional[str] = "Client GotoShop"
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_id: Optional[str] = None
    customer_token: Optional[str] = None
    delivery_fee: int = 500
    notes: Optional[str] = None
    register_account: Optional[bool] = False
    country: Optional[str] = "Burkina Faso"
    city: Optional[str] = "Ouagadougou"
    delivery_neighborhood: Optional[str] = None
    coupon_code: Optional[str] = None
    use_tier_discount: Optional[bool] = True

    @field_validator("customer_id", "customer_token", "customer_phone", "customer_email", "coupon_code", mode="before")
    @classmethod
    def clean_strings(cls, v):
        if v is None or not str(v).strip() or str(v).strip().lower() in ["none", "null", "undefined"]:
            return None
        return str(v).strip()

    @field_validator("delivery_fee", mode="before")
    @classmethod
    def parse_fee(cls, v):
        if v is None or v == "" or str(v).strip().lower() in ["none", "null"]:
            return 500
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return 500

class AcceptOrderRequest(BaseModel):
    seller_name: Optional[str] = "Commerçant"

class RejectOrderRequest(BaseModel):
    reason: Optional[str] = "Indisponible temporairement"
    seller_name: Optional[str] = "Commerçant"

class CancelOrderRequest(BaseModel):
    reason: Optional[str] = "Annulé par le client"
    actor_name: Optional[str] = "Client"

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

class MobileMoneyPaymentRequest(BaseModel):
    operator: str # ORANGE_MONEY, MOOV_MONEY
    phone_number: str
    otp_code: str
    customer_name: Optional[str] = "Client"
    is_test_mode: Optional[bool] = False

class CheckCouponRequest(BaseModel):
    store_id: str
    code: str
    order_amount: int = 0


@router.post("/check-coupon", summary="Vérifier la validité d'un code coupon")
def check_order_coupon(req: CheckCouponRequest, db: Session = Depends(get_db)):
    from app.services.loyalty_service import LoyaltyService
    from app.services.store_service import StoreService
    store = StoreService.resolve_store(db, slug=req.store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return LoyaltyService.validate_coupon(db, store.id, req.code, req.order_amount)


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
            notes=req.notes,
            register_account=bool(req.register_account),
            country=req.country or "Burkina Faso",
            city=req.city or req.delivery.delivery_city or "Ouagadougou",
            delivery_neighborhood=req.delivery_neighborhood or req.delivery.delivery_address,
            coupon_code=req.coupon_code,
            use_tier_discount=bool(req.use_tier_discount),
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
    include_hidden: bool = Query(False),
    db: Session = Depends(get_db)
):
    return OrderService.list_orders(
        db=db,
        store_id=store_id,
        customer_id=customer_id,
        customer_token=customer_token,
        status=status,
        include_hidden=include_hidden
    )


@router.get("/{order_id}", summary="Détail complet d'une commande")
def get_order(order_id: str, db: Session = Depends(get_db)):
    res = OrderService.get_order_by_id(db=db, order_id=order_id)
    if not res:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    return res


@router.post("/{order_id}/accept", summary="Accepter une commande (vendeur)")
def accept_order(order_id: str, req: AcceptOrderRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _require_seller(db, order_id, authorization)
    try:
        return OrderService.accept_order(db=db, order_id=order_id, seller_name=req.seller_name or "Commerçant")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/reject", summary="Refuser une commande (vendeur)")
def reject_order(order_id: str, req: RejectOrderRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _require_seller(db, order_id, authorization)
    try:
        return OrderService.reject_order(db=db, order_id=order_id, reason=req.reason, seller_name=req.seller_name or "Commerçant")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/cancel", summary="Annuler une commande (client ou vendeur)")
def cancel_order(order_id: str, req: Optional[CancelOrderRequest] = None, db: Session = Depends(get_db)):
    try:
        actor = req.actor_name if req else "Client"
        reason = req.reason if req else "Annulé par le client"
        return OrderService.cancel_order(db=db, order_id=order_id, reason=reason, actor_name=actor)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/archive-client", summary="Archiver une commande dans l'espace client")
def archive_order_client(order_id: str, db: Session = Depends(get_db)):
    try:
        return OrderService.archive_order_client(db=db, order_id=order_id, is_archived=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/unarchive-client", summary="Désarchiver une commande dans l'espace client")
def unarchive_order_client(order_id: str, db: Session = Depends(get_db)):
    try:
        return OrderService.archive_order_client(db=db, order_id=order_id, is_archived=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{order_id}/hide-client", summary="Masquer définitivement de l'historique client (sans suppression BDD)")
def hide_order_client(order_id: str, db: Session = Depends(get_db)):
    try:
        return OrderService.hide_order_client(db=db, order_id=order_id)
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
def confirm_payment(order_id: str, req: ConfirmPaymentRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _require_seller(db, order_id, authorization)
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
def reject_payment(order_id: str, req: RejectPaymentRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _require_seller(db, order_id, authorization)
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
def update_status(order_id: str, req: UpdateOrderStatusRequest, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    _require_seller(db, order_id, authorization)
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


class RequestOtpRequest(BaseModel):
    phone_number: str
    operator: Optional[str] = "ORANGE"


@router.post("/{order_id}/request-otp", summary="Demander un code OTP de confirmation Mobile Money")
def request_payment_otp(order_id: str, req: RequestOtpRequest, db: Session = Depends(get_db)):
    from app.models.order import Order
    from app.services.otp_service import OtpService
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    ok, msg, data = OtpService.request_otp(req.phone_number, order.id, order.total_amount)
    if not ok:
        raise HTTPException(status_code=429, detail=msg)
    return {"success": True, "message": msg, **data}


@router.post("/{order_id}/pay-mobile-money", summary="Payer une commande via Mobile Money LigdiCash (Orange / Moov avec OTP)")
def pay_mobile_money(order_id: str, req: MobileMoneyPaymentRequest, db: Session = Depends(get_db)):
    try:
        return PaymentService.process_ligdicash_payment(
            db=db,
            order_id=order_id,
            operator=req.operator,
            phone_number=req.phone_number,
            otp_code=req.otp_code,
            customer_name=req.customer_name or "Client",
            is_test_mode=bool(req.is_test_mode)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
