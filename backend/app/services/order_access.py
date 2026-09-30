"""Preuve de propriété d'une commande pour les actions « côté client » (annuler, archiver, masquer…).

Règles :
- le vendeur propriétaire de la boutique (ou le SuperAdmin) est autorisé via l'en-tête Authorization
  (uniquement quand l'action l'autorise, cf. ``allow_seller``) ;
- sinon le client doit présenter un ``customer_token`` (jeton de session client, ou jeton invité de la
  commande). Un ``customer_id`` seul n'est PAS une preuve : il apparaît dans les réponses de l'API.
  S'il est fourni en plus du jeton, il doit correspondre au propriétaire de la commande.
"""
import secrets
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.order import Order


def _same(a: Optional[str], b: Optional[str]) -> bool:
    return bool(a) and bool(b) and secrets.compare_digest(str(a), str(b))


def _seller_authorized(db: Session, store_id: str, authorization: Optional[str]) -> bool:
    if not authorization:
        return False
    try:
        from app.routers.auth import require_store_admin
        require_store_admin(store_id, authorization, db)
        return True
    except HTTPException:
        return False


def _customer_owns(
    db: Session,
    owner_customer_id: Optional[str],
    owner_token: Optional[str],
    customer_id: Optional[str],
    customer_token: Optional[str],
) -> bool:
    if not customer_token:
        return False
    if customer_id and owner_customer_id and str(customer_id) != str(owner_customer_id):
        return False
    if _same(customer_token, owner_token):
        return True
    if owner_customer_id:
        cust = db.query(Customer).filter(Customer.id == owner_customer_id).first()
        from app.services.customer_service import CustomerService
        if CustomerService.token_matches(cust, customer_token):
            return True
    return False


def verify_order_access(
    db: Session,
    order_id_or_ref: str,
    customer_id: Optional[str] = None,
    customer_token: Optional[str] = None,
    authorization: Optional[str] = None,
    allow_seller: bool = False,
) -> str:
    """Lève 401/403/404 si l'appelant n'est pas autorisé ; retourne ``"seller"`` ou ``"customer"``."""
    from app.models.commerce import OrderIntent

    ref = str(order_id_or_ref or "").strip()
    order = db.query(Order).filter((Order.id == ref) | (Order.order_number == ref) | (Order.order_number == ref.upper())).first()

    intent = None
    if not order:
        intent = db.query(OrderIntent).filter(
            (OrderIntent.id == ref) | (OrderIntent.reference_code == ref) | (OrderIntent.reference_code == ref.upper())
        ).first()
        if intent:
            # Une intention issue d'une commande conversationnelle partage sa référence : la commande fait foi.
            order = db.query(Order).filter(Order.order_number == intent.reference_code).first()

    if not order and not intent:
        raise HTTPException(status_code=404, detail="Commande introuvable")

    store_id = order.store_id if order else intent.store_id
    if allow_seller and _seller_authorized(db, store_id, authorization):
        return "seller"

    from app.services.customer_service import CustomerService
    customer_token = CustomerService.effective_token(customer_token)
    if not customer_token:
        raise HTTPException(
            status_code=401,
            detail="Preuve d'identité requise : connectez-vous ou utilisez l'appareil qui a passé la commande.",
        )

    if order:
        owned = _customer_owns(db, order.customer_id, order.customer_token, customer_id, customer_token)
    else:
        # Intention sans commande : le jeton de suivi remis au client à la création fait aussi preuve
        # (cas d'un visiteur anonyme, sans compte).
        followup = getattr(intent, "followup_task", None)
        followup_token = followup.secure_token if followup else None
        owned = _same(customer_token, followup_token) or _customer_owns(
            db, intent.customer_id, None, customer_id, customer_token
        )

    if not owned:
        raise HTTPException(status_code=403, detail="Cette commande ne vous appartient pas.")
    return "customer"
