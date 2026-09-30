from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from app.database import get_db
from app.core.ratelimit import rate_limit
from app.services.customer_service import CustomerService
from app.services.store_service import StoreService
from app.routers.auth import require_store_admin
from app.models.customer import Customer
from app.schemas.customer import (
    CustomerQuickRegisterRequest,
    CustomerQuickLoginRequest,
    CustomerLoginOtpRequest,
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

def _bind_store(req, slug: Optional[str], db: Session):
    """Sans store_id explicite, la boutique est celle du contexte (X-Store-Slug) : sinon le compte était créé
    dans la première boutique de la base, pas dans celle où le client se trouve."""
    if not getattr(req, "store_id", None) and slug:
        store = StoreService.resolve_store(db, slug=slug)
        if store:
            req.store_id = store.id


@router.post("/login/otp/request")
def request_login_otp(req: CustomerLoginOtpRequest, x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
                      db: Session = Depends(get_db)):
    _bind_store(req, x_store_slug, db)
    try:
        return CustomerService.request_login_otp(db, req.phone, req.store_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/quick-register", response_model=CustomerAuthResponse)
def quick_register(req: CustomerQuickRegisterRequest, x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
                   db: Session = Depends(get_db), _rl=Depends(rate_limit("quick-register", 10, 60))):
    _bind_store(req, x_store_slug, db)
    try:
        customer, token = CustomerService.quick_register(db, req)
        return CustomerAuthResponse(
            access_token=CustomerService.expose(token),
            token_type="bearer",
            customer=CustomerResponse.model_validate(customer),
            message="Bienvenue chez Awa Chic & Tech !"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur d'inscription: {str(e)}")

@router.post("/quick-login", response_model=CustomerAuthResponse)
def quick_login(req: CustomerQuickLoginRequest, x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
                db: Session = Depends(get_db), _rl=Depends(rate_limit("quick-login", 10, 60))):
    _bind_store(req, x_store_slug, db)
    try:
        customer, token = CustomerService.quick_login(db, req)
        return CustomerAuthResponse(
            access_token=CustomerService.expose(token),
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

@router.get("/loyalty-card", summary="Ma carte de fidélité (données d'impression)")
def get_my_loyalty_card(
    request: Request,
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    from app.models.store import Store
    from app.services import card_service
    store = db.query(Store).filter(Store.id == customer.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    stats = CustomerService.get_customer_stats(db, customer)
    return card_service.build_card_payload(db, customer, store, stats, card_service.public_origin(request))


@router.get("/merchant/clients/{customer_id}/loyalty-card", summary="Carte de fidélité d'un client (commerçant)")
def get_merchant_client_card(
    customer_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    from app.models.store import Store
    from app.services import card_service
    target = db.query(Customer).filter(Customer.id == customer_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Client introuvable")
    require_store_admin(target.store_id, authorization, db)
    store = db.query(Store).filter(Store.id == target.store_id).first()
    stats = CustomerService.get_customer_stats(db, target)
    return card_service.build_card_payload(db, target, store, stats, card_service.public_origin(request))


@router.get("/stats", response_model=CustomerStatsResponse)
def get_my_stats(
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    return CustomerService.get_customer_stats(db, customer)


@router.get("/loyalty/history", summary="Historique des points de fidélité")
def get_my_loyalty_history(
    limit: int = 50,
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    from app.services.loyalty_service import LoyaltyService
    rows = LoyaltyService.get_ledger_history(db, customer.id, customer.store_id, limit=limit)
    for r in rows:  # stockage en dixièmes -> points
        r["points"] = r["points"] / 10.0
        r["balance_after"] = r["balance_after"] / 10.0
    return rows


@router.get("/loyalty/coupons", summary="Coupons et récompenses actifs du client")
def get_my_loyalty_coupons(
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    from app.services.loyalty_service import LoyaltyService
    return LoyaltyService.get_active_coupons(db, customer.id, customer.store_id)


@router.get("/loyalty/summary", summary="Solde, échéances et conditions de rachat des points")
def get_my_loyalty_summary(
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    from app.services.loyalty_service import (
        LoyaltyService, REDEEM_FCFA_PER_POINT, REDEEM_MIN_POINTS, REDEEM_COUPON_VALIDITY_DAYS,
    )
    expiry = LoyaltyService.get_expiry_summary(db, customer.id, customer.store_id)
    expiry["points_expiring_soon"] = (expiry.get("points_expiring_soon") or 0) / 10.0
    db.refresh(customer)
    return {
        "balance": (customer.bonus_points or 0) / 10.0,
        "model": "v3",
        **__import__("app.services.loyalty_v3", fromlist=["next_gain_info"]).next_gain_info(db, customer.store_id, customer.id),
        "redeem_fcfa_per_point": REDEEM_FCFA_PER_POINT,
        "redeem_min_points": REDEEM_MIN_POINTS,
        "coupon_validity_days": REDEEM_COUPON_VALIDITY_DAYS,
        **expiry,
        "coupons": LoyaltyService.get_active_coupons(db, customer.id, customer.store_id),
    }


class RedeemPointsRequest(BaseModel):
    points: int


@router.post("/loyalty/redeem", summary="Échanger des points contre un bon d'achat")
def redeem_my_points(
    req: RedeemPointsRequest,
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    from app.services.loyalty_service import LoyaltyService
    try:
        result = LoyaltyService.redeem_points_for_coupon(db, customer.store_id, customer.id, req.points)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


class ValidateCouponRequest(BaseModel):
    code: str
    order_amount: int = 0


@router.post("/loyalty/validate-coupon", summary="Valider un code coupon")
def validate_customer_coupon(
    req: ValidateCouponRequest,
    customer = Depends(get_current_customer),
    db: Session = Depends(get_db)
):
    from app.services.loyalty_service import LoyaltyService
    return LoyaltyService.validate_coupon(db, customer.store_id, req.code, req.order_amount, customer_id=customer.id)


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
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    store = StoreService.resolve_store(db, slug=slug) if slug else StoreService.get_default_store(db)
    if not store:
        return []
    require_store_admin(store.id, authorization, db)  # customer PII: owner only
    return CustomerService.get_merchant_clients(db, store.id, search=search)

@router.get("/merchant/clients/{customer_id}", response_model=MerchantClientDetail)
def get_merchant_client_detail(
    customer_id: str,
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    store = StoreService.resolve_store(db, slug=slug) if slug else StoreService.get_default_store(db)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    require_store_admin(store.id, authorization, db)
    client = CustomerService.get_merchant_client_detail(db, store.id, customer_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")
    return client

@router.post("/merchant/clients/{customer_id}/moderate")
def moderate_client(
    customer_id: str,
    req: ModerateClientRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # The store is the customer's own store (was: always the default store).
    target = db.query(Customer).filter(Customer.id == customer_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Client introuvable")
    require_store_admin(target.store_id, authorization, db)
    store = StoreService.resolve_store(db, slug=target.store_id)
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
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    target = db.query(Customer).filter(Customer.id == customer_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Client introuvable")
    require_store_admin(target.store_id, authorization, db)
    store = StoreService.resolve_store(db, slug=target.store_id)
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
        "bonus_points": (updated.bonus_points or 0) / 10.0,
        "custom_discount_percent": updated.custom_discount_percent,
        "custom_perk_note": updated.custom_perk_note,
        "message": f"Avantage accordé avec succès à {updated.name} !"
    }



@router.post("/logout", summary="Fermer la session client (efface le cookie HttpOnly)")
def customer_logout(customer=Depends(get_current_customer), db: Session = Depends(get_db)):
    CustomerService.clear_session(customer)
    db.commit()
    return {"success": True, "message": "Déconnexion réussie."}
