"""Fidélité v3 : points cumulables, dépensés sur UN produit (1 point = 1 % de son prix unitaire).

Unité de stockage : le DIXIÈME de point (entier). 5 = 0,5 pt. Voir MODELE_FIDELITE.md.
Gain au n-ième paiement validé : (5 + n // 3) dixièmes -> 0,5 pt aux paiements 1-2, 0,6 au 3e, ... 1,0 au 15e, 1,1 au 18e...
"""
import os
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.loyalty import LoyaltyLedgerEntry
from app.services.loyalty_service import LoyaltyService
from app.core.clock import utcnow

SCALE = 10
EARNED = "EARNED_ORDER"
SPENT = "SPENT_ITEM"
RETURNED = "RETURNED_SPENT"


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return float(default)


def max_tenths_per_use() -> int:
    """Plafond par utilisation (défaut 20 pt = 20 % du produit). Réglage : LOYALTY_MAX_POINTS_PER_USE."""
    return int(round(_env_float("LOYALTY_MAX_POINTS_PER_USE", 20) * SCALE))


def min_order_amount() -> int:
    """Montant minimum (produits, après remise) pour qu'un paiement compte. Réglage : LOYALTY_MIN_ORDER_FCFA."""
    return int(_env_float("LOYALTY_MIN_ORDER_FCFA", 1000))


def gain_tenths(n: int) -> int:
    return 5 + max(0, int(n)) // 3


def fmt(tenths: int) -> str:
    return f"{tenths / SCALE:g}".replace(".", ",")


def payments_counted(db: Session, store_id: str, customer_id: str) -> int:
    return db.query(LoyaltyLedgerEntry).filter(
        LoyaltyLedgerEntry.store_id == store_id,
        LoyaltyLedgerEntry.customer_id == customer_id,
        LoyaltyLedgerEntry.entry_type == EARNED,
    ).count()


def next_gain_info(db: Session, store_id: str, customer_id: str) -> dict:
    n = payments_counted(db, store_id, customer_id) + 1
    left = 3 - (n % 3) if n % 3 else 3
    return {
        "payments_counted": n - 1,
        "next_gain": gain_tenths(n) / SCALE,
        "payments_before_increase": left,
        "gain_after_increase": gain_tenths(n + left) / SCALE,
        "max_points_per_use": max_tenths_per_use() / SCALE,
        "min_order_fcfa": min_order_amount(),
    }


def credit_for_delivery(db: Session, order) -> Optional[LoyaltyLedgerEntry]:
    """Crédite le gain d'un paiement validé (commande livrée). Idempotent, une fois par commande."""
    if not order.customer_id:
        return None
    existing = db.query(LoyaltyLedgerEntry).filter(
        LoyaltyLedgerEntry.order_id == order.id, LoyaltyLedgerEntry.entry_type == EARNED
    ).first()
    if existing:
        return existing
    eligible = int(order.subtotal_amount or 0) - int(order.discount_amount or 0)
    if eligible < min_order_amount():
        return None
    # Un seul paiement compté par boutique et par jour (anti-fractionnement)
    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    if db.query(LoyaltyLedgerEntry).filter(
        LoyaltyLedgerEntry.store_id == order.store_id,
        LoyaltyLedgerEntry.customer_id == order.customer_id,
        LoyaltyLedgerEntry.entry_type == EARNED,
        LoyaltyLedgerEntry.created_at >= today,
    ).first():
        return None
    n = payments_counted(db, order.store_id, order.customer_id) + 1
    tenths = gain_tenths(n)
    return LoyaltyService.credit_points(
        db=db, store_id=order.store_id, customer_id=order.customer_id, points=tenths,
        entry_type=EARNED, order_id=order.id, validity_days=0,
        description=f"Paiement n°{n} : +{fmt(tenths)} pt (commande #{order.order_number})",
    )


def spend_on_item(db: Session, *, store_id: str, customer_id: str, order_id: str, order_number: str,
                  unit_price: int, product_name: str, points: float) -> int:
    """Débite les points choisis et renvoie la remise en FCFA (sur UNE unité du produit). Sans commit."""
    raw = float(points)
    tenths = int(round(raw * SCALE))
    if tenths <= 0 or abs(raw * SCALE - tenths) > 1e-6:
        raise ValueError("Le nombre de points doit être un multiple de 0,1.")
    if tenths > max_tenths_per_use():
        raise ValueError(f"Maximum {fmt(max_tenths_per_use())} pt par utilisation.")
    discount = int(unit_price) * tenths // 1000  # tenths/10 % du prix unitaire
    if discount <= 0:
        raise ValueError("Ces points n'apportent aucune remise sur ce produit.")
    discount = min(discount, int(unit_price))
    LoyaltyService.debit_points(
        db, store_id, customer_id, tenths, entry_type=SPENT, order_id=order_id, commit=False,
        description=f"{fmt(tenths)} pt utilisés sur « {product_name} » (commande #{order_number})",
    )
    return discount


def refund_spent(db: Session, order) -> None:
    """Rend les points dépensés sur une commande annulée/rejetée (idempotent)."""
    if not order.customer_id:
        return
    spent = db.query(LoyaltyLedgerEntry).filter(
        LoyaltyLedgerEntry.order_id == order.id, LoyaltyLedgerEntry.entry_type == SPENT
    ).first()
    if not spent or not spent.points:
        return
    LoyaltyService.credit_points(
        db=db, store_id=order.store_id, customer_id=order.customer_id, points=abs(spent.points),
        entry_type=RETURNED, order_id=order.id, validity_days=0,
        description=f"Points rendus (commande #{order.order_number} annulée)",
    )


def lifetime_earned_points(db: Session, store_id: str, customer_id: str) -> float:
    """Points gagnés depuis toujours (paiements + gestes du marchand), en points. Sert au STATUT
    (Bronze/Argent/Or...), indépendamment de ce que le client a dépensé."""
    from sqlalchemy import func
    total = db.query(func.coalesce(func.sum(LoyaltyLedgerEntry.points), 0)).filter(
        LoyaltyLedgerEntry.store_id == store_id,
        LoyaltyLedgerEntry.customer_id == customer_id,
        LoyaltyLedgerEntry.points > 0,
        LoyaltyLedgerEntry.entry_type != RETURNED,
    ).scalar() or 0
    return int(total) / SCALE


def tier_for(points: float) -> str:
    """Statut par défaut (boutique sans paliers personnalisés)."""
    if points >= 30:
        return "Gold VIP"
    if points >= 10:
        return "Silver"
    return "Bronze"
