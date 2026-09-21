from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.super_admin import get_current_super_admin
from app.models.super_admin import SuperAdmin
from app.services.subscription_service import SubscriptionService
from app.schemas.subscription import (
    SubscriptionPublicInfoResponse,
    SubscriptionRequestSubmitSchema,
    SubscriptionRequestReviewSchema,
    SubscriptionRequestItemSchema,
    SubscriptionPlanSchema,
    SubscriptionPlanUpdateSchema,
    PaymentUssdConfigSchema,
    PaymentUssdConfigUpdateSchema
)

router = APIRouter(prefix="/subscription", tags=["Subscription"])

# 1. Public Endpoints
@router.get("/public-info", response_model=SubscriptionPublicInfoResponse)
def get_subscription_public_info(db: Session = Depends(get_db)):
    """Returns active subscription plans, USSD providers, and precomputed dial links."""
    return SubscriptionService.get_public_info(db)

@router.post("/submit", response_model=SubscriptionRequestItemSchema)
def submit_subscription_request(req: SubscriptionRequestSubmitSchema, db: Session = Depends(get_db)):
    """Allows a new merchant or existing merchant to submit an onboarding or renewal request with payment screenshot."""
    try:
        sub_req = SubscriptionService.submit_request(db, req)
        return sub_req
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la soumission: {str(e)}")

@router.get("/store/{store_id}/status")
def get_store_subscription_status(store_id: str, db: Session = Depends(get_db)):
    """Returns the subscription status and remaining days for a given store."""
    try:
        return SubscriptionService.get_store_subscription_status(db, store_id)
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))

# 2. Super Admin Endpoints
@router.get("/requests", response_model=List[SubscriptionRequestItemSchema])
def list_subscription_requests(
    status: Optional[str] = Query("ALL"),
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Lists all subscription requests with optional status filter."""
    return SubscriptionService.get_requests(db, status=status)

@router.get("/requests/{req_id}", response_model=SubscriptionRequestItemSchema)
def get_subscription_request(
    req_id: str,
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Fetches a single subscription request."""
    sub_req = SubscriptionService.get_request_by_id(db, req_id)
    if not sub_req:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return sub_req

@router.post("/requests/{req_id}/review", response_model=SubscriptionRequestItemSchema)
def review_subscription_request(
    req_id: str,
    review: SubscriptionRequestReviewSchema,
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Approves (creates store / renews + generates credentials) or rejects a request."""
    try:
        return SubscriptionService.review_request(
            db=db,
            req_id=req_id,
            review=review,
            admin_name=admin.full_name or admin.email
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/plans", response_model=List[SubscriptionPlanSchema])
def list_admin_plans(
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Lists all plans."""
    SubscriptionService.seed_defaults(db)
    from app.models.subscription import SubscriptionPlan
    return db.query(SubscriptionPlan).order_by(SubscriptionPlan.display_order.asc()).all()

@router.put("/plans/{plan_id}", response_model=SubscriptionPlanSchema)
def update_admin_plan(
    plan_id: str,
    data: SubscriptionPlanUpdateSchema,
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Updates plan pricing, description, or status."""
    updated = SubscriptionService.update_plan(db, plan_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Plan introuvable")
    return updated

@router.get("/ussd-configs", response_model=List[PaymentUssdConfigSchema])
def list_admin_ussd_configs(
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Lists all USSD operator configurations."""
    SubscriptionService.seed_defaults(db)
    from app.models.subscription import PaymentUssdConfig
    return db.query(PaymentUssdConfig).order_by(PaymentUssdConfig.display_order.asc()).all()

@router.put("/ussd-configs/{config_id}", response_model=PaymentUssdConfigSchema)
def update_admin_ussd_config(
    config_id: str,
    data: PaymentUssdConfigUpdateSchema,
    admin: SuperAdmin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Super Admin: Updates USSD pattern, merchant number, or instructions."""
    updated = SubscriptionService.update_ussd_config(db, config_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Configuration USSD introuvable")
    return updated
