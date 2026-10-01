"""Authentification sans mot de passe : Passkeys (WebAuthn), codes de récupération, appareils, sessions, journal.

Toute la logique est dans PasskeyService ; ce routeur ne fait que du transport HTTP.
Session client = Customer.session_token (le même que le reste de l'application, pas de second système).
"""
from typing import Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.ratelimit import rate_limit
from app.database import get_db
from app.models.customer import Customer
from app.routers.customer import get_current_customer
from app.schemas.customer import CustomerResponse
from app.services.customer_service import normalize_phone, CustomerService
from app.services.passkey_service import PasskeyService, PasskeyError
from app.services.phone_verification import get_phone_verification_provider

router = APIRouter(prefix="/auth", tags=["Passkeys"])


def _require_enabled():
    if not settings.PASSKEY_ENABLED:
        raise HTTPException(status_code=404, detail="Authentification par Passkey désactivée.")
    from app.services.passkey_service import WEBAUTHN_AVAILABLE
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(status_code=503, detail="Passkeys indisponibles sur cette instance serveur.")


def _meta(request: Request):
    fwd = request.headers.get("x-forwarded-for")
    ip = fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else None)
    return ip, request.headers.get("user-agent")


def _fail(e: Exception, code: int = 400):
    raise HTTPException(status_code=code, detail=str(e))


class RegisterVerifyBody(BaseModel):
    challenge_id: str
    credential: Dict[str, Any]
    friendly_name: Optional[str] = None


class LoginVerifyBody(BaseModel):
    challenge_id: str
    credential: Dict[str, Any]


class RenameBody(BaseModel):
    friendly_name: str


class RecoveryUseBody(BaseModel):
    phone: str
    code: str
    store_id: Optional[str] = None
    otp_code: Optional[str] = None  # exigé seulement si OTP_REQUIRED_FOR_ACCOUNT_RECOVERY=true


class RecoveryOtpBody(BaseModel):
    phone: str


def _customer_for_registration(db: Session, authorization: Optional[str], recovery_token: Optional[str]):
    """Enregistrement autorisé avec une session client OU une session de récupération limitée. Retourne (customer, via_recovery)."""
    if recovery_token:
        c = PasskeyService.customer_from_recovery_token(db, recovery_token)
        if not c:
            raise HTTPException(status_code=401, detail="Session de récupération expirée ou invalide.")
        return c, True
    return get_current_customer(authorization=authorization, db=db), False


# ---------------------------------------------------------------- enregistrement d'une Passkey
@router.post("/passkeys/register/options", dependencies=[Depends(rate_limit("passkey-reg-opts", 20, 60))])
def passkey_register_options(authorization: Optional[str] = Header(None),
                             x_recovery_token: Optional[str] = Header(None, alias="X-Recovery-Token"),
                             db: Session = Depends(get_db)):
    _require_enabled()
    customer, _ = _customer_for_registration(db, authorization, x_recovery_token)
    try:
        return PasskeyService.register_options(db, customer)
    except PasskeyError as e:
        _fail(e)


@router.post("/passkeys/register/verify", dependencies=[Depends(rate_limit("passkey-reg-verify", 20, 60))])
def passkey_register_verify(body: RegisterVerifyBody, request: Request, authorization: Optional[str] = Header(None),
                            x_recovery_token: Optional[str] = Header(None, alias="X-Recovery-Token"),
                            db: Session = Depends(get_db)):
    _require_enabled()
    customer, via_recovery = _customer_for_registration(db, authorization, x_recovery_token)
    ip, ua = _meta(request)
    try:
        cred = PasskeyService.register_verify(db, customer, body.challenge_id, body.credential, body.friendly_name, ip, ua)
    except PasskeyError as e:
        _fail(e)
    out: Dict[str, Any] = {"success": True, "passkey": _serialize(cred)}
    if via_recovery:
        # La récupération aboutit : le jeton limité est consommé et une session normale est ouverte.
        PasskeyService.consume_recovery_token(db, x_recovery_token)
        out["access_token"] = CustomerService.expose(PasskeyService.issue_session(db, customer))
        out["session_started"] = True  # la session vit dans le cookie HttpOnly même si le jeton n'est pas renvoyé
        out["token_type"] = "bearer"
        out["customer"] = CustomerResponse.model_validate(customer).model_dump(mode="json")
    # Première configuration : les codes de récupération sont générés automatiquement (affichés une seule fois).
    if settings.RECOVERY_CODES_ENABLED and PasskeyService.remaining_recovery_codes(db, customer) == 0:
        out["recovery_codes"] = PasskeyService.generate_recovery_codes(db, customer, ip, ua)
    return out


# ---------------------------------------------------------------- connexion
@router.post("/passkeys/login/options", dependencies=[Depends(rate_limit("passkey-login-opts", 30, 60))])
def passkey_login_options(db: Session = Depends(get_db)):
    _require_enabled()
    return PasskeyService.login_options(db)


@router.post("/passkeys/login/verify", dependencies=[Depends(rate_limit("passkey-login-verify", 15, 60))])
def passkey_login_verify(body: LoginVerifyBody, request: Request, db: Session = Depends(get_db)):
    _require_enabled()
    ip, ua = _meta(request)
    try:
        customer, token = PasskeyService.login_verify(db, body.challenge_id, body.credential, ip, ua)
    except PasskeyError as e:
        _fail(e, 401)
    return {"access_token": CustomerService.expose(token), "token_type": "bearer", "customer": CustomerResponse.model_validate(customer).model_dump(mode="json"),
            "phone_verified": bool(customer.phone_verified)}


# ---------------------------------------------------------------- gestion des appareils
def _serialize(c) -> Dict[str, Any]:
    return {"id": c.id, "friendly_name": c.friendly_name, "device_type": c.device_type, "backed_up": bool(c.backed_up),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "last_used_at": c.last_used_at.isoformat() if c.last_used_at else None}


@router.get("/passkeys")
def list_passkeys(customer: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    _require_enabled()
    return {"passkeys": [_serialize(c) for c in PasskeyService.list_passkeys(db, customer)]}


@router.patch("/passkeys/{passkey_id}")
def rename_passkey(passkey_id: str, body: RenameBody, customer: Customer = Depends(get_current_customer),
                   db: Session = Depends(get_db)):
    _require_enabled()
    try:
        return _serialize(PasskeyService.rename_passkey(db, customer, passkey_id, body.friendly_name))
    except PasskeyError as e:
        _fail(e, 404)


@router.delete("/passkeys/{passkey_id}")
def revoke_passkey(passkey_id: str, request: Request, customer: Customer = Depends(get_current_customer),
                   db: Session = Depends(get_db)):
    _require_enabled()
    ip, ua = _meta(request)
    # Ne pas s'enfermer dehors : la dernière Passkey ne se révoque que s'il reste des codes de récupération.
    active = PasskeyService.list_passkeys(db, customer)
    if len(active) <= 1 and PasskeyService.remaining_recovery_codes(db, customer) == 0:
        raise HTTPException(status_code=409, detail="Impossible de révoquer votre seule Passkey sans code de récupération disponible.")
    try:
        PasskeyService.revoke_passkey(db, customer, passkey_id, ip, ua)
    except PasskeyError as e:
        _fail(e, 404)
    return {"success": True}


# ---------------------------------------------------------------- codes de récupération
@router.post("/recovery-codes/generate")
def generate_recovery_codes(request: Request, customer: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    ip, ua = _meta(request)
    if not PasskeyService.list_passkeys(db, customer):
        raise HTTPException(status_code=409, detail="Configurez d'abord une Passkey.")
    try:
        codes = PasskeyService.generate_recovery_codes(db, customer, ip, ua)
    except PasskeyError as e:
        _fail(e)
    return {"codes": codes, "warning": "Ces codes ne sont affichés qu'une seule fois. Les anciens codes ne fonctionnent plus."}


@router.get("/recovery-codes/status")
def recovery_codes_status(customer: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    return {"remaining": PasskeyService.remaining_recovery_codes(db, customer)}


@router.post("/recovery-codes/revoke")
def revoke_recovery_codes(customer: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    return {"revoked": PasskeyService.revoke_recovery_codes(db, customer)}


@router.post("/recovery-codes/otp/request", dependencies=[Depends(rate_limit("recovery-otp", 5, 60))])
def recovery_otp_request(body: RecoveryOtpBody):
    """Utilisé seulement si OTP_REQUIRED_FOR_ACCOUNT_RECOVERY=true (via PhoneVerificationProvider)."""
    if not settings.OTP_REQUIRED_FOR_ACCOUNT_RECOVERY:
        raise HTTPException(status_code=404, detail="Vérification téléphonique non requise.")
    ok, msg = get_phone_verification_provider().send(normalize_phone(body.phone), "recovery")
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"success": True, "message": msg}


@router.post("/recovery-codes/use", dependencies=[Depends(rate_limit("recovery-use", 8, 60))])
@router.post("/passkeys/recovery", dependencies=[Depends(rate_limit("recovery-use", 8, 60))])
def use_recovery_code(body: RecoveryUseBody, request: Request, db: Session = Depends(get_db)):
    """Consomme un code et renvoie un jeton de récupération limité (à envoyer dans X-Recovery-Token pour
    /auth/passkeys/register/options et /verify). Il ne donne accès à rien d'autre."""
    ip, ua = _meta(request)
    if settings.OTP_REQUIRED_FOR_ACCOUNT_RECOVERY:
        if not body.otp_code:
            raise HTTPException(status_code=400, detail="Code de vérification téléphonique requis.")
        ok, msg = get_phone_verification_provider().verify(normalize_phone(body.phone), "recovery", body.otp_code)
        if not ok:
            raise HTTPException(status_code=400, detail=msg)
    try:
        token = PasskeyService.use_recovery_code(db, body.phone, body.code, body.store_id, ip, ua)
    except PasskeyError as e:
        _fail(e, 401)
    return {"recovery_token": token, "expires_in_minutes": 10}


# ---------------------------------------------------------------- journal & sessions
@router.get("/security/events")
def security_events(limit: int = 50, customer: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    return {"events": [{"event_type": e.event_type, "created_at": e.created_at.isoformat(), "user_agent": e.user_agent}
                       for e in PasskeyService.list_events(db, customer, limit)]}


@router.post("/sessions/revoke")
@router.post("/sessions/revoke-all")
def revoke_sessions(request: Request, customer: Customer = Depends(get_current_customer), db: Session = Depends(get_db)):
    ip, ua = _meta(request)
    PasskeyService.revoke_sessions(db, customer, ip, ua)
    return {"success": True}
