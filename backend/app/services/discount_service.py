"""Remises boutique : le commerçant définit des remises automatiques par audience.

Audiences : ALL (tous), CLIENTS (comptes clients), VISITORS (sans compte), SELECTED (clients choisis).
Portée : STORE (toute la commande), PRODUCT (produits choisis) ou CATEGORY (catégories choisies).
Une remise PRODUCT / CATEGORY ne porte que sur les lignes concernées et seulement pour le public choisi.
La remise personnelle d'un client (custom_discount_percent) compte comme une règle à part (portée STORE).
Une seule remise s'applique : la plus forte en montant. Elle n'est pas cumulée avec un coupon (le meilleur des deux gagne).
"""
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.store import StoreDiscountRule
from app.core.clock import utcnow

AUDIENCES = ("ALL", "CLIENTS", "VISITORS", "SELECTED")
SCOPES = ("STORE", "PRODUCT", "CATEGORY")
SCOPE_LABELS = {"STORE": "Toute la commande", "PRODUCT": "Produits choisis", "CATEGORY": "Catégories choisies"}
AUDIENCE_LABELS = {
    "ALL": "Tous",
    "CLIENTS": "Clients inscrits",
    "VISITORS": "Visiteurs",
    "SELECTED": "Clients choisis",
}


def _json_ids(raw) -> List[str]:
    try:
        v = json.loads(raw or "[]")
        return [str(x) for x in v] if isinstance(v, list) else []
    except (TypeError, ValueError):
        return []


def _ids(rule: StoreDiscountRule) -> List[str]:
    return _json_ids(rule.customer_ids)


def _scope(rule: StoreDiscountRule) -> str:
    sc = str(getattr(rule, "scope", None) or "STORE").upper()
    return sc if sc in SCOPES else "STORE"


def rule_to_dict(rule: StoreDiscountRule) -> Dict[str, Any]:
    ids = _ids(rule)
    return {
        "id": rule.id,
        "name": rule.name,
        "percent": rule.percent,
        "audience": rule.audience,
        "audience_label": AUDIENCE_LABELS.get(rule.audience, rule.audience),
        "customer_ids": ids,
        "scope": _scope(rule),
        "scope_label": SCOPE_LABELS.get(_scope(rule), "Toute la commande"),
        "product_ids": _json_ids(getattr(rule, "product_ids", None)),
        "category_ids": _json_ids(getattr(rule, "category_ids", None)),
        "min_order_amount": rule.min_order_amount or 0,
        "starts_at": rule.starts_at.isoformat() if rule.starts_at else None,
        "ends_at": rule.ends_at.isoformat() if rule.ends_at else None,
        "is_active": bool(rule.is_active),
        "created_at": rule.created_at.isoformat() if rule.created_at else None,
    }


def _matches(rule: StoreDiscountRule, customer, now: datetime, subtotal: int) -> bool:
    if not rule.is_active:
        return False
    if rule.starts_at and now < rule.starts_at:
        return False
    if rule.ends_at and now > rule.ends_at:
        return False
    if subtotal < int(rule.min_order_amount or 0):
        return False
    if rule.audience == "ALL":
        return True
    if rule.audience == "CLIENTS":
        return customer is not None
    if rule.audience == "VISITORS":
        return customer is None
    if rule.audience == "SELECTED":
        return customer is not None and str(customer.id) in _ids(rule)
    return False


def _eligible_amount(rule: StoreDiscountRule, lines: Optional[List[Dict[str, Any]]], subtotal: int) -> int:
    """Montant de la commande sur lequel la remise porte (toute la commande, ou seulement les lignes concernées)."""
    scope = _scope(rule)
    if scope == "STORE":
        return subtotal
    if not lines:
        return 0
    if scope == "PRODUCT":
        wanted = set(_json_ids(rule.product_ids))
        key = "product_id"
    else:
        wanted = set(_json_ids(rule.category_ids))
        key = "category_id"
    if not wanted:
        return 0
    return sum(int(l.get("amount") or 0) for l in lines if l.get(key) and str(l[key]) in wanted)


def best_for(db: Session, store_id: str, customer, subtotal: int,
             lines: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """Meilleure remise applicable (la plus forte en montant).

    `customer` = client identifié (compte existant) ou None (visiteur).
    `lines` = lignes de la commande [{"product_id", "category_id", "amount"}] ; nécessaire pour les remises
    PRODUCT / CATEGORY (sans lignes, seules les remises sur toute la commande s'appliquent).
    """
    subtotal = int(subtotal or 0)
    if subtotal <= 0:
        return None
    now = utcnow()
    best: Optional[Dict[str, Any]] = None
    rules = db.query(StoreDiscountRule).filter(
        StoreDiscountRule.store_id == store_id, StoreDiscountRule.is_active == True  # noqa: E712
    ).all()
    for r in rules:
        if not _matches(r, customer, now, subtotal):
            continue
        pct = max(0, min(100, int(r.percent or 0)))
        eligible = _eligible_amount(r, lines, subtotal)
        amount = min(eligible, eligible * pct // 100)
        if pct <= 0 or amount <= 0:
            continue
        if best is None or amount > best["amount"] or (amount == best["amount"] and pct > best["percent"]):
            best = {"rule_id": r.id, "name": r.name, "percent": pct, "source": "RULE", "audience": r.audience,
                    "scope": _scope(r), "eligible_amount": eligible, "amount": amount}
    personal = int(getattr(customer, "custom_discount_percent", 0) or 0) if customer is not None else 0
    if personal > 0:
        p_pct = min(100, personal)
        p_amount = min(subtotal, subtotal * p_pct // 100)
        if p_amount > 0 and (best is None or p_amount > best["amount"]):
            best = {"rule_id": None, "name": "Remise personnelle", "percent": p_pct, "source": "PERSONAL",
                    "audience": "SELECTED", "scope": "STORE", "eligible_amount": subtotal, "amount": p_amount}
    return best


def build_lines(db: Session, store_id: str, raw_lines: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Complète des lignes [{"product_id" (id ou slug), "amount"}] avec la catégorie du produit (produits de CETTE boutique seulement)."""
    from app.models.catalog import Product
    out: List[Dict[str, Any]] = []
    for l in raw_lines or []:
        pid = l.get("product_id")
        prod = None
        if pid:
            prod = db.query(Product).filter(Product.store_id == store_id, Product.id == str(pid)).first()
            if prod is None:
                prod = db.query(Product).filter(Product.store_id == store_id, Product.slug == str(pid)).first()
        out.append({
            "product_id": prod.id if prod else None,
            "category_id": prod.category_id if prod else None,
            "amount": max(0, int(l.get("amount") or 0)),
        })
    return out


def validate_payload(db: Session, store_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from app.models.customer import Customer
    name = str(data.get("name") or "").strip()
    if len(name) < 2:
        raise ValueError("Donnez un nom à la remise (ex. Promo de la rentrée).")
    try:
        percent = int(data.get("percent"))
    except (TypeError, ValueError):
        raise ValueError("Pourcentage invalide.")
    if not 1 <= percent <= 100:
        raise ValueError("Le pourcentage doit être entre 1 et 100.")
    audience = str(data.get("audience") or "ALL").upper()
    if audience not in AUDIENCES:
        raise ValueError("Audience invalide.")
    ids: List[str] = []
    if audience == "SELECTED":
        raw = data.get("customer_ids") or []
        ids = list({str(x) for x in raw})
        if not ids:
            raise ValueError("Choisissez au moins un client.")
        found = {c[0] for c in db.query(Customer.id).filter(Customer.store_id == store_id, Customer.id.in_(ids)).all()}
        if set(ids) - found:
            raise ValueError("Un des clients choisis n'appartient pas à cette boutique.")
    scope = str(data.get("scope") or "STORE").upper()
    if scope not in SCOPES:
        raise ValueError("Portée invalide (toute la commande, produits ou catégories).")
    product_ids: List[str] = []
    category_ids: List[str] = []
    if scope == "PRODUCT":
        from app.models.catalog import Product
        product_ids = list({str(x) for x in (data.get("product_ids") or [])})
        if not product_ids:
            raise ValueError("Choisissez au moins un produit.")
        found = {p[0] for p in db.query(Product.id).filter(Product.store_id == store_id, Product.id.in_(product_ids)).all()}
        if set(product_ids) - found:
            raise ValueError("Un des produits choisis n'appartient pas à cette boutique.")
    elif scope == "CATEGORY":
        from app.models.catalog import Category
        category_ids = list({str(x) for x in (data.get("category_ids") or [])})
        if not category_ids:
            raise ValueError("Choisissez au moins une catégorie.")
        found = {c[0] for c in db.query(Category.id).filter(Category.store_id == store_id, Category.id.in_(category_ids)).all()}
        if set(category_ids) - found:
            raise ValueError("Une des catégories choisies n'appartient pas à cette boutique.")
    def _dt(v):
        if not v:
            return None
        try:
            return datetime.fromisoformat(str(v).replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            raise ValueError("Date invalide.")
    starts, ends = _dt(data.get("starts_at")), _dt(data.get("ends_at"))
    if starts and ends and ends < starts:
        raise ValueError("La date de fin précède la date de début.")
    return {
        "name": name[:120], "percent": percent, "audience": audience,
        "customer_ids": json.dumps(ids) if audience == "SELECTED" else None,
        "scope": scope,
        "product_ids": json.dumps(product_ids) if scope == "PRODUCT" else None,
        "category_ids": json.dumps(category_ids) if scope == "CATEGORY" else None,
        "min_order_amount": max(0, int(data.get("min_order_amount") or 0)),
        "starts_at": starts, "ends_at": ends, "is_active": bool(data.get("is_active", True)),
    }
