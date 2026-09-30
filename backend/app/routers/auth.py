from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.ratelimit import rate_limit
from typing import Optional
from app.database import get_db
from app.services.auth_service import AuthService, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_TEMP_PASSWORD
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ChangePasswordRequest,
    PasswordValidationResponse,
    OwnerAuthStatus
)
from app.core.security import validate_strong_password
from app.config import settings

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
    if not settings.PASSWORD_AUTH_ENABLED:
        raise HTTPException(status_code=403, detail="Connexion par mot de passe désactivée.")
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

@router.post("/demo-login", response_model=LoginResponse)
def demo_login(payload: Optional[dict] = None, db: Session = Depends(get_db)):
    """
    1-Click instant test admin connection shortcut:
    Instantly logs in as the demo store admin (or the requested demo store slug)
    without prompting for passwords.
    """
    target_slug = (payload or {}).get("store_slug") or (payload or {}).get("target_slug") or (payload or {}).get("slug")
    try:
        owner, token = AuthService.demo_login(db, target_slug)
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
            must_change_password=False,
            owner_name=owner.full_name or "Commerçant Démo",
            email=owner.email,
            message="Connexion 1-clic réussie !",
            store_ids=store_ids,
            store_slugs=store_slugs,
            owned_stores=owned_stores,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erreur interne lors de la connexion démo.")

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not settings.PASSWORD_AUTH_ENABLED:
        raise HTTPException(status_code=403, detail="Connexion par mot de passe désactivée.")
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Jeton d'authentification manquant.")
    try:
        updated_owner = AuthService.change_password(db, token, req)
        return {
            "success": True,
            "message": "Mot de passe fort enregistré avec succès ! Votre compte est pleinement sécurisé.",
            "access_token": getattr(updated_owner, "raw_session_token", None),
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
        # SECURITY: no more "dev fallback". A missing token is always rejected.
        raise HTTPException(
            status_code=401,
            detail="Authentification requise : connectez-vous en tant que commerçant."
        )

    # 1. SuperAdmin bypass
    from app.models.super_admin import SuperAdmin
    from app.core.security import lookup_hash
    super_admin = db.query(SuperAdmin).filter(SuperAdmin.session_token == lookup_hash(token)).first()
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

    if not target_store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")

    if target_store.owner_id != owner.id:
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
def reset_credentials(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    # SECURITY: this used to be public, letting anyone reset the first owner's
    # password to the well-known default. Only a SuperAdmin session may do it.
    from app.models.super_admin import SuperAdmin
    token = extract_token(authorization)
    from app.core.security import lookup_hash
    if not token or not db.query(SuperAdmin).filter(SuperAdmin.session_token == lookup_hash(token)).first():
        raise HTTPException(status_code=403, detail="Réservé au super-administrateur.")
    from app.models.store import Owner
    owner = db.query(Owner).first()
    if not owner:
        from app.seed.seeder import seed_database
        seed_database()
        owner = db.query(Owner).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Propriétaire non trouvé.")
    temp = AuthService.reset_to_default_credentials(db, owner)
    from app.config import settings as _cfg
    return {
        "success": True,
        # hors développement le mot de passe est aléatoire : affiché une seule fois, à transmettre au commerçant
        **({"temporary_password": temp} if _cfg.APP_ENV != "dev" else {}),
        "message": f"Identifiants réinitialisés avec succès pour {owner.email} !",
        "email": owner.email,
    }


def get_merchant_principal(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Authenticates a merchant (store owner) or SuperAdmin from the bearer token.
    Returns the SuperAdmin / Owner object; raises 401 otherwise."""
    token = extract_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Authentification requise.")
    from app.models.super_admin import SuperAdmin
    from app.core.security import lookup_hash
    sa = db.query(SuperAdmin).filter(SuperAdmin.session_token == lookup_hash(token)).first()
    if sa:
        return sa
    owner = AuthService.get_owner_by_token(db, token)
    if not owner:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée.")
    return owner


def assert_store_access(principal, store_id: Optional[str]):
    """SuperAdmin passes; an Owner must own the store (id or slug). 403 otherwise."""
    from app.models.super_admin import SuperAdmin
    if isinstance(principal, SuperAdmin):
        return
    ids = {str(s.id) for s in (principal.stores or [])} | {str(s.slug) for s in (principal.stores or [])}
    if not store_id or str(store_id) not in ids:
        raise HTTPException(status_code=403, detail="Accès interdit à cette boutique.")


class _ResetRequest(BaseModel):
    identifier: str  # e-mail ou téléphone du commerçant


class _ResetConfirm(BaseModel):
    identifier: str
    code: str
    new_password: str
    confirm_password: str


@router.post("/password-reset/request", dependencies=[Depends(rate_limit("pwd-reset-req", 5, 300))])
def password_reset_request(body: _ResetRequest, db: Session = Depends(get_db)):
    """Envoie un OTP de réinitialisation sur WhatsApp (réponse identique que le compte existe ou non)."""
    from app.services.password_reset_service import PasswordResetService
    return PasswordResetService.request(db, body.identifier)


@router.post("/password-reset/confirm", dependencies=[Depends(rate_limit("pwd-reset-confirm", 10, 300))])
def password_reset_confirm(body: _ResetConfirm, db: Session = Depends(get_db)):
    from app.services.password_reset_service import PasswordResetService
    try:
        PasswordResetService.confirm(db, body.identifier, body.code, body.new_password, body.confirm_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "message": "Mot de passe mis à jour. Reconnectez-vous."}
