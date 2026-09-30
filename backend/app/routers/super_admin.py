from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Query
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


# --- Platform Wallet & Withdrawals ---

@router.get("/withdrawals", summary="Lister les demandes de retrait de toutes les boutiques")
def list_withdrawals(
    status: Optional[str] = None,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.wallet import WalletTransaction
    q = db.query(WalletTransaction).filter(WalletTransaction.transaction_type == "WITHDRAWAL_REQUEST")
    if status:
        q = q.filter(WalletTransaction.status == status)
    txs = q.order_by(WalletTransaction.created_at.desc()).limit(100).all()
    return [
        {
            "id": t.id,
            "store_id": t.store_id,
            "store_name": t.store.name if t.store else "Boutique",
            "amount": t.amount,
            "status": t.status,
            "reference": t.reference,
            "note": t.note,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in txs
    ]


@router.post("/withdrawals/{tx_id}/approve", summary="Approuver un retrait commerçant")
def approve_withdrawal(
    tx_id: str,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.wallet import WalletTransaction
    tx = db.query(WalletTransaction).filter(WalletTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    tx.status = "COMPLETED"
    db.commit()
    return {"success": True, "message": "Retrait validé", "status": "COMPLETED"}


@router.post("/withdrawals/{tx_id}/reject", summary="Rejeter un retrait commerçant et restituer les fonds")
def reject_withdrawal(
    tx_id: str,
    reason: Optional[str] = Query(None),
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.wallet import WalletTransaction, MerchantWallet
    tx = db.query(WalletTransaction).filter(WalletTransaction.id == tx_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    if tx.status != "COMPLETED":
        wallet = db.query(MerchantWallet).filter(MerchantWallet.id == tx.wallet_id).first()
        if wallet:
            wallet.available_balance += tx.amount
            wallet.total_withdrawn = max(0, wallet.total_withdrawn - tx.amount)
        tx.status = "REJECTED"
        tx.note = (tx.note or "") + (f" [Rejeté: {reason}]" if reason else "")
        db.commit()
    return {"success": True, "message": "Retrait rejeté et fonds restitués", "status": "REJECTED"}


# --- Multi-store Client Management ---

@router.get("/clients", summary="Rechercher des clients sur toute la plateforme")
def list_all_clients(
    search: Optional[str] = None,
    store_id: Optional[str] = None,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.customer import Customer
    q = db.query(Customer)
    if store_id:
        q = q.filter(Customer.store_id == store_id)
    if search:
        s = f"%{search}%"
        q = q.filter((Customer.name.ilike(s)) | (Customer.phone.ilike(s)) | (Customer.loyalty_card_no.ilike(s)))
    clients = q.order_by(Customer.created_at.desc()).limit(100).all()
    return [
        {
            "id": c.id,
            "store_id": c.store_id,
            "store_name": c.store.name if c.store else None,
            "name": c.name,
            "phone": c.phone,
            "loyalty_card_no": c.loyalty_card_no,
            "bonus_points": (c.bonus_points or 0) / 10.0,
            "is_blocked": bool(c.is_blocked),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in clients
    ]


@router.post("/clients/{customer_id}/toggle-block", summary="Bloquer/Débloquer un client")
def toggle_block_client(
    customer_id: str,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.customer import Customer
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Client introuvable")
    cust.is_blocked = not bool(cust.is_blocked)
    db.commit()
    return {"success": True, "is_blocked": cust.is_blocked}


# --- Audit & Security Log ---

@router.get("/audit-logs", summary="Journal des actions et de sécurité")
def get_platform_audit_logs(
    limit: int = 50,
    admin = Depends(get_current_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.audit import AuditLog
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "event_name": l.event_name,
            "actor_type": l.actor_type,
            "actor_name": l.actor_name,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.post("/owners/{owner_id}/reset-credentials")
def reset_owner_credentials(owner_id: str, admin=Depends(get_current_super_admin), db: Session = Depends(get_db)):
    """Génère un mot de passe temporaire pour UN commerçant (changement obligatoire à la connexion) et prépare
    le message à copier/envoyer (lien WhatsApp inclus). Le mot de passe n'est affiché qu'une fois."""
    from app.models.store import Owner
    from app.services.auth_service import AuthService
    from app.services.password_reset_service import whatsapp_link
    owner = db.query(Owner).filter(Owner.id == owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Commerçant introuvable.")
    temp = AuthService.reset_to_default_credentials(db, owner)
    owner.session_token = None
    db.commit()
    msg = (f"GotoShop - vos identifiants ont été réinitialisés.\nE-mail : {owner.email}\n"
           f"Mot de passe temporaire : {temp}\nVous devrez le changer à la première connexion.")
    return {"success": True, "email": owner.email, "temporary_password": temp,
            "message_to_copy": msg, "whatsapp_link": whatsapp_link(owner.phone_number, msg)}
