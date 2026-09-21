from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.services.customer_service import CustomerService
from app.services.store_service import StoreService
from app.schemas.customer import (
    CustomerQuickRegisterRequest,
    CustomerQuickLoginRequest,
    CustomerProfileUpdateRequest,
    CustomerResponse,
    CustomerAuthResponse,
    CustomerOrderItem,
    CustomerStatsResponse,
    MerchantClientItem,
    MerchantClientDetail,
    ModerateClientRequest,
    GrantClientPerkRequest,
)

router = APIRouter(prefix="/customer", tags=["Customer Portal"])

def extract_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return authorization

def get_current_customer(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Session client requise. Veuillez vous identifier.")
    customer = CustomerService.get_by_token(db, token)
    if not customer:
        raise HTTPException(status_code=401, detail="Session client expirée ou invalide.")
    return customer

@router.post("/quick-register", response_model=CustomerAuthResponse)
def quick_register(req: CustomerQuickRegisterRequest, db: Session = Depends(get_db)):
    try:
        customer, token = CustomerService.quick_register(db, req)
        return CustomerAuthResponse(
            access_token=token,
            token_type="bearer",
            customer=CustomerResponse.model_validate(customer),
            message="Bienvenue chez Awa Chic & Tech !"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'inscription: {str(e)}")

@router.post("/quick-login", response_model=CustomerAuthResponse)
def quick_login(req: CustomerQuickLoginRequest, db: Session = Depends(get_db)):
    try:
        customer, token = CustomerService.quick_login(db, req)
        return CustomerAuthResponse(
            access_token=token,
            token_type="bearer",
            customer=CustomerResponse.model_validate(customer),
            message=f"Ravi de vous revoir, {customer.name} !"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me", response_model=CustomerResponse)
def get_my_profile(customer = Depends(get_current_customer)):
    return CustomerResponse.model_validate(customer)

@router.put("/profile", response_model=CustomerResponse)
def update_profile(
    req: CustomerProfileUpdateRequest,
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    updated = CustomerService.update_profile(db, customer, req)
    return CustomerResponse.model_validate(updated)

@router.get("/orders", response_model=List[CustomerOrderItem])
def get_my_orders(
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    return CustomerService.get_customer_orders(db, customer)

@router.get("/stats", response_model=CustomerStatsResponse)
def get_my_stats(
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    return CustomerService.get_customer_stats(db, customer)

class LinkOrdersRequest(BaseModel):
    order_ids: List[str]

@router.post("/link-guest-orders")
def link_guest_orders(
    req: LinkOrdersRequest,
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    count = CustomerService.link_guest_orders(db, customer, req.order_ids)
    return {"success": True, "linked_count": count}

# --- Merchant CRM / Client Management Endpoints ---

@router.get("/merchant/clients", response_model=List[MerchantClientItem])
def list_merchant_clients(
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    store = StoreService.get_default_store(db)
    if not store:
        return []
    return CustomerService.get_merchant_clients(db, store.id, search=search)

@router.get("/merchant/clients/{customer_id}", response_model=MerchantClientDetail)
def get_merchant_client_detail(
    customer_id: str,
    db: Session = Depends(get_db)
):
    store = StoreService.get_default_store(db)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    client = CustomerService.get_merchant_client_detail(db, store.id, customer_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return client

@router.post("/merchant/clients/{customer_id}/moderate")
def moderate_client(
    customer_id: str,
    req: ModerateClientRequest,
    db: Session = Depends(get_db)
):
    store = StoreService.get_default_store(db)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    updated = CustomerService.moderate_client(
        db, store.id, customer_id, is_blocked=req.is_blocked, notes=req.moderation_notes
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return {
        "success": True,
        "is_blocked": updated.is_blocked,
        "moderation_notes": updated.moderation_notes,
        "message": "Client bloqué" if updated.is_blocked else "Modération mise à jour"
    }

@router.post("/merchant/clients/{customer_id}/grant-perk")
def grant_client_perk(
    customer_id: str,
    req: GrantClientPerkRequest,
    db: Session = Depends(get_db)
):
    store = StoreService.get_default_store(db)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    updated = CustomerService.grant_client_perk(
        db,
        store.id,
        customer_id,
        bonus_points=req.bonus_points or 0,
        discount_pct=req.custom_discount_percent or 0,
        perk_note=req.custom_perk_note
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return {
        "success": True,
        "bonus_points": updated.bonus_points,
        "custom_discount_percent": updated.custom_discount_percent,
        "custom_perk_note": updated.custom_perk_note,
        "message": f"Avantage accordé avec succès à {updated.name} !"
    }

