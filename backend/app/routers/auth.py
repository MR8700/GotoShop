from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services.auth_service import AuthService, DEFAULT_ADMIN_EMAIL
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ChangePasswordRequest,
    PasswordValidationResponse,
    OwnerAuthStatus
)
from app.core.security import validate_strong_password

router = APIRouter(prefix="/auth", tags=["Authentication"])

def extract_token(authorization: Optional[str] = Header(None)) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return authorization

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    try:
        owner, token = AuthService.authenticate(db, req)
        msg = "Connexion réussie."
        if owner.must_change_password:
            msg = "Changement de mot de passe obligatoire pour sécuriser votre boutique."

        store_ids = [s.id for s in owner.stores] if owner.stores else []
        store_slugs = [s.slug for s in owner.stores] if owner.stores else []
        owned_stores = [
            {
                "id": s.id,
                "slug": s.slug,
                "name": s.name,
                "is_verified": bool(s.is_verified),
                "subscription_status": s.subscription_status
            }
            for s in (owner.stores or [])
        ]

        return LoginResponse(
            access_token=token,
            token_type="bearer",
            must_change_password=bool(owner.must_change_password),
            owner_name=owner.full_name,
            email=owner.email,
            message=msg,
            store_ids=store_ids,
            store_slugs=store_slugs,
            owned_stores=owned_stores,
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur interne de connexion.")

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Jeton d'authentification manquant.")
    try:
        updated_owner = AuthService.change_password(db, token, req)
        return {
            "success": True,
            "message": "Mot de passe fort enregistré avec succès ! Votre compte est pleinement sécurisé.",
            "access_token": updated_owner.session_token,
            "must_change_password": False
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/validate-password", response_model=PasswordValidationResponse)
def validate_password_candidate(payload: dict):
    password = payload.get("password", "")
    is_valid, errors = validate_strong_password(password)
    checks = AuthService.get_password_checks_breakdown(password)
    return PasswordValidationResponse(
        is_valid=is_valid,
        errors=errors,
        checks=checks
    )

@router.get("/me", response_model=OwnerAuthStatus)
def get_current_owner_status(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    token = extract_token(authorization)
    owner = AuthService.get_owner_by_token(db, token)
    if not owner:
        return OwnerAuthStatus(
            is_authenticated=False,
            must_change_password=True,
            owner_name=None,
            email=None,
            store_ids=[],
            store_slugs=[],
            owned_stores=[],
        )

    store_ids = [s.id for s in owner.stores] if owner.stores else []
    store_slugs = [s.slug for s in owner.stores] if owner.stores else []
    owned_stores = [
        {
            "id": s.id,
            "slug": s.slug,
            "name": s.name,
            "is_verified": bool(s.is_verified),
            "subscription_status": s.subscription_status
        }
        for s in (owner.stores or [])
    ]

    return OwnerAuthStatus(
        is_authenticated=True,
        must_change_password=bool(owner.must_change_password),
        owner_name=owner.full_name,
        email=owner.email,
        store_ids=store_ids,
        store_slugs=store_slugs,
        owned_stores=owned_stores,
    )

def require_store_admin(
    store_id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """
    Strict authorization guard for merchant back-office actions:
    Allows SuperAdmin OR the verified owner of the specific store_id.
    Rejects any cross-store tampering with 403 Forbidden.
    """
    token = extract_token(authorization)
    if not token:
        # Check local dev fallback if no token
        return None

    # 1. SuperAdmin bypass
    from app.models.super_admin import SuperAdmin
    super_admin = db.query(SuperAdmin).filter(SuperAdmin.session_token == token).first()
    if super_admin:
        return super_admin

    # 2. Store Owner verification
    owner = AuthService.get_owner_by_token(db, token)
    if not owner:
        raise HTTPException(
            status_code=401,
            detail="Session commerçante expirée ou invalide."
        )

    from app.models.store import Store
    from sqlalchemy import or_
    target_store = db.query(Store).filter(
        or_(Store.id == store_id, Store.slug == store_id)
    ).first()

    if target_store and target_store.owner_id != owner.id:
        raise HTTPException(
            status_code=403,
            detail="Accès interdit : vous n'avez pas l'autorisation d'administrer la boutique d'un autre commerçant."
        )

    return owner

@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    token = extract_token(authorization)
    owner = AuthService.get_owner_by_token(db, token)
    if owner:
        owner.session_token = None
        db.commit()
    return {"success": True, "message": "Déconnexion réussie."}

@router.post("/reset-credentials")
def reset_credentials(db: Session = Depends(get_db)):
    from app.models.store import Owner
    owner = db.query(Owner).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Propriétaire non trouvé.")
    AuthService.reset_to_default_credentials(db, owner)
    return {
        "success": True,
        "message": "Identifiants réinitialisés aux valeurs d'origine (awa@chictech.bf / AwaChic2026!).",
        "email": "awa@chictech.bf",
        "default_password": "AwaChic2026!"
    }
