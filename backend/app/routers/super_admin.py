from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.super_admin_service import SuperAdminService
from app.schemas.super_admin import (
    SuperAdminLoginRequest,
    SuperAdminLoginResponse,
    SuperAdminStoreCreateRequest,
    SuperAdminStoreStatusRequest,
    SuperAdminStoreItem,
    SuperAdminOverview
)

router = APIRouter(prefix="/super-admin", tags=["SuperAdmin"])

def get_current_super_admin(
    authorization: Optional[str] = Header(None),
    x_super_token: Optional[str] = Header(None, alias="X-Super-Token"),
    db: Session = Depends(get_db)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif x_super_token:
        token = x_super_token

    if not token:
        raise HTTPException(status_code=401, detail="Jeton Super-Admin requis")

    admin = SuperAdminService.get_admin_by_token(db, token)
    if not admin:
        raise HTTPException(status_code=401, detail="Session Super-Admin invalide ou expirée")
    return admin

@router.post("/login", response_model=SuperAdminLoginResponse)
def login_super_admin(req: SuperAdminLoginRequest, db: Session = Depends(get_db)):
    res = SuperAdminService.login(db, req.email, req.password)
    if not res:
        raise HTTPException(status_code=401, detail="Email ou mot de passe Super-Admin incorrect")
    return res

@router.get("/me")
def get_super_admin_me(admin = Depends(get_current_super_admin)):
    return {
        "is_authenticated": True,
        "admin": {
            "id": admin.id,
            "email": admin.email,
            "full_name": admin.full_name
        }
    }

@router.post("/logout")
def logout_super_admin(admin = Depends(get_current_super_admin), db: Session = Depends(get_db)):
    admin.session_token = None
    db.commit()
    return {"success": True, "message": "Déconnexion réussie"}

@router.get("/overview", response_model=SuperAdminOverview)
def get_platform_overview(
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    return SuperAdminService.get_overview(db)

@router.get("/stores", response_model=List[SuperAdminStoreItem])
def list_stores(
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    return SuperAdminService.list_all_stores(db)

@router.post("/stores", response_model=SuperAdminStoreItem)
def create_store(
    req: SuperAdminStoreCreateRequest,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    try:
        return SuperAdminService.create_merchant_store(db, req)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/stores/{store_id}/status", response_model=SuperAdminStoreItem)
def update_store_status(
    store_id: str,
    req: SuperAdminStoreStatusRequest,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    item = SuperAdminService.update_store_status(db, store_id, req)
    if not item:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return item

@router.post("/stores/{store_id}/verify", response_model=SuperAdminStoreItem)
def verify_store(
    store_id: str,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    """Valider et approuver officiellement une boutique pour publication immédiate."""
    item = SuperAdminService.verify_store(db, store_id, is_verified=True)
    if not item:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    return item

@router.post("/stores/{store_id}/impersonate")
def impersonate_merchant(
    store_id: str,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    res = SuperAdminService.impersonate_store(db, store_id)
    if not res:
        raise HTTPException(status_code=404, detail="Boutique ou commerçant introuvable")
    return res

@router.delete("/stores/{store_id}")
def delete_store(
    store_id: str,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    try:
        ok = SuperAdminService.delete_store(db, store_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Boutique introuvable")
        return {"success": True, "message": "Boutique supprimée avec succès"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
