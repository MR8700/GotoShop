import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.customer import Customer
from app.models.store import Store, LoyaltyTier
from app.models.loyalty import LoyaltyLedgerEntry, LoyaltyRewardCoupon
from app.models.notifications import StoreNotification

DEFAULT_TIERS = [
    {"name": "Bronze", "min_points": 0, "discount_percent": 0, "badge": "bronze"},
    {"name": "Argent", "min_points": 10, "discount_percent": 0, "badge": "silver"},
    {"name": "Or", "min_points": 30, "discount_percent": 0, "badge": "gold"},
    {"name": "Platine", "min_points": 60, "discount_percent": 0, "badge": "platinum"},
]


# Rachat de points contre un bon d'achat (valeurs par défaut, à ajuster selon la politique commerciale).
REDEEM_FCFA_PER_POINT = 25          # 1 point rachetable = 25 FCFA de remise
REDEEM_MIN_POINTS = 20              # rachat minimum (= 500 FCFA)
REDEEM_COUPON_VALIDITY_DAYS = 30    # durée de validité du bon généré


def _utcnow() -> datetime:
    """UTC naïf : les colonnes DateTime sont sans fuseau, on compare donc naïf avec naïf."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class LoyaltyService:
    @staticmethod
    def get_tier_info(points: int, custom_tiers: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Determine tier, discount, and progress based on active points."""
        tiers = custom_tiers or DEFAULT_TIERS
        tiers = sorted(tiers, key=lambda t: t.get("min_points", 0))

        current_tier = tiers[0]
        current_rank = 0
        for i, t in enumerate(tiers):
            if points >= t.get("min_points", 0):
                current_tier = t
                current_rank = i

        next_tier = None
        next_progress = 100
        points_to_next = 0

        if current_rank < len(tiers) - 1:
            next_t = tiers[current_rank + 1]
            next_tier = next_t.get("name")
            span = next_t.get("min_points", 0) - current_tier.get("min_points", 0)
            earned_in_tier = max(0, points - current_tier.get("min_points", 0))
            next_progress = min(100, int((earned_in_tier / span) * 100)) if span > 0 else 100
            points_to_next = max(0, next_t.get("min_points", 0) - points)

        return {
            "tier_name": current_tier.get("name", "Bronze"),
            "tier_rank": current_rank,
            "tier_count": len(tiers),
            "discount_percent": current_tier.get("discount_percent", 0),
            "badge": current_tier.get("badge", "bronze"),
            "next_tier": next_tier,
            "next_tier_progress": next_progress,
            "points_to_next": points_to_next,
            "all_tiers": tiers,
        }

    @staticmethod
    def get_customer_balance(db: Session, customer_id: str, store_id: str) -> int:
        """Calculate live balance from customer record or ledger (points expirés déduits)."""
        LoyaltyService.expire_due_points(db, store_id, customer_id)
        cust = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not cust:
            return 0
        return cust.bonus_points or 0

    @staticmethod
    def _open_lots(db: Session, store_id: str, customer_id: str) -> List[LoyaltyLedgerEntry]:
        """Lots de points encore utilisables, dans l'ordre FIFO (expiration la plus proche d'abord)."""
        lots = db.query(LoyaltyLedgerEntry).filter(
            LoyaltyLedgerEntry.store_id == store_id,
            LoyaltyLedgerEntry.customer_id == customer_id,
            LoyaltyLedgerEntry.points > 0,
            LoyaltyLedgerEntry.is_expired == False,
            LoyaltyLedgerEntry.points_remaining > 0,
        ).all()
        far_future = datetime.max
        return sorted(
            lots,
            key=lambda e: (e.expires_at is None, _naive_utc(e.expires_at) or far_future, _naive_utc(e.created_at) or far_future),
        )

    @staticmethod
    def expire_due_points(db: Session, store_id: str, customer_id: str, commit: bool = True) -> int:
        """Expire les lots échus (les plus anciens d'abord). Retourne le nombre de points expirés.

        Écrit une entrée EXPIRED dans le grand livre et ramène le solde du client à jour.
        """
        now = _utcnow()
        due = [
            lot for lot in LoyaltyService._open_lots(db, store_id, customer_id)
            if lot.expires_at is not None and _naive_utc(lot.expires_at) <= now
        ]
        if not due:
            return 0

        cust = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not cust:
            return 0

        total = sum(lot.points_remaining or 0 for lot in due)
        for lot in due:
            lot.points_remaining = 0
            lot.is_expired = True

        current_balance = cust.bonus_points or 0
        expired_points = min(total, current_balance)  # le solde ne peut jamais devenir négatif
        if expired_points > 0:
            new_balance = current_balance - expired_points
            cust.bonus_points = new_balance
            db.add(LoyaltyLedgerEntry(
                store_id=store_id,
                customer_id=customer_id,
                order_id=None,
                entry_type="EXPIRED",
                points=-expired_points,
                balance_after=new_balance,
                description=f"{expired_points} points fidélité expirés",
                points_remaining=None,
                created_at=now,
            ))
            db.add(StoreNotification(
                store_id=store_id,
                notification_type="SYSTEM",
                title="Points de fidélité expirés",
                message=f"{expired_points} points ont expiré. Nouveau solde : {new_balance} pts.",
            ))
        if commit:
            db.commit()
        return expired_points

    @staticmethod
    def get_consumed_points(db: Session, customer_id: str, store_id: str) -> int:
        """Total des points sortis du solde (rachats, expirations, ajustements négatifs)."""
        total = db.query(func.coalesce(func.sum(LoyaltyLedgerEntry.points), 0)).filter(
            LoyaltyLedgerEntry.customer_id == customer_id,
            LoyaltyLedgerEntry.store_id == store_id,
            LoyaltyLedgerEntry.points < 0,
        ).scalar() or 0
        return abs(int(total))

    @staticmethod
    def get_expiry_summary(db: Session, customer_id: str, store_id: str, within_days: int = 30) -> Dict[str, Any]:
        """Prochaine échéance et points qui expirent bientôt (pour informer le client)."""
        LoyaltyService.expire_due_points(db, store_id, customer_id)
        horizon = _utcnow() + timedelta(days=within_days)
        lots = [l for l in LoyaltyService._open_lots(db, store_id, customer_id) if l.expires_at is not None]
        soon = sum(l.points_remaining or 0 for l in lots if _naive_utc(l.expires_at) <= horizon)
        return {
            "next_expiry_at": _naive_utc(lots[0].expires_at).isoformat() if lots else None,
            "points_expiring_soon": soon,
            "within_days": within_days,
        }

    @staticmethod
    def credit_points(
        db: Session,
        store_id: str,
        customer_id: str,
        points: int,
        entry_type: str = "EARNED_ORDER",
        description: str = "Points fidélité gagnés",
        order_id: Optional[str] = None,
        validity_days: int = 365,
    ) -> LoyaltyLedgerEntry:
        """Credit points to customer, record immutable ledger entry, and update customer tier/balance."""
        if points <= 0:
            raise ValueError("Les points crédités doivent être supérieurs à 0")

        # Idempotence : une même commande ne doit jamais créditer deux fois le même type de
        # points (ex. rejeu d'un webhook, double appel de update_status vers DELIVERED).
        if order_id:
            existing = db.query(LoyaltyLedgerEntry).filter(
                LoyaltyLedgerEntry.order_id == order_id,
                LoyaltyLedgerEntry.entry_type == entry_type,
            ).first()
            if existing:
                return existing

        cust = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not cust:
            raise ValueError("Client introuvable pour cette boutique")

        # Les lots échus sont retirés avant de créditer, pour que le solde affiché reste exact.
        LoyaltyService.expire_due_points(db, store_id, customer_id, commit=False)

        current_balance = cust.bonus_points or 0
        new_balance = current_balance + points
        cust.bonus_points = new_balance

        now = _utcnow()
        expires_at = now + timedelta(days=validity_days) if validity_days else None

        entry = LoyaltyLedgerEntry(
            store_id=store_id,
            customer_id=customer_id,
            order_id=order_id,
            entry_type=entry_type,
            points=points,
            balance_after=new_balance,
            description=description,
            expires_at=expires_at,
            points_remaining=points,
            created_at=now,
        )
        db.add(entry)

        # Notify customer about points
        notif = StoreNotification(
            store_id=store_id,
            notification_type="SYSTEM",
            title="Points de fidélité crédités !",
            message=f"+{points / 10:g} pt ajouté(s) à votre compte ! Nouveau solde : {new_balance / 10:g} pts.",
        )
        db.add(notif)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def debit_points(
        db: Session,
        store_id: str,
        customer_id: str,
        points: int,
        entry_type: str = "REDEEMED_DISCOUNT",
        description: str = "Points utilisés pour remise",
        order_id: Optional[str] = None,
        commit: bool = True,
    ) -> LoyaltyLedgerEntry:
        """Debit points from customer if balance allows (consomme les lots les plus proches de l'expiration d'abord)."""
        if points <= 0:
            raise ValueError("Les points débités doivent être supérieurs à 0")

        # Verrou de ligne (ignoré par SQLite) : évite deux rachats simultanés sur le même solde.
        cust = db.query(Customer).filter(
            Customer.id == customer_id, Customer.store_id == store_id
        ).with_for_update().first()
        if not cust:
            raise ValueError("Client introuvable")

        LoyaltyService.expire_due_points(db, store_id, customer_id, commit=False)

        current_balance = cust.bonus_points or 0
        if current_balance < points:
            raise ValueError(f"Solde insuffisant ({current_balance / 10:g} pts disponibles, {points / 10:g} demandés)")

        new_balance = current_balance - points
        cust.bonus_points = new_balance

        # FIFO : on vide d'abord les lots qui expirent en premier.
        to_consume = points
        for lot in LoyaltyService._open_lots(db, store_id, customer_id):
            if to_consume <= 0:
                break
            taken = min(lot.points_remaining or 0, to_consume)
            lot.points_remaining = (lot.points_remaining or 0) - taken
            to_consume -= taken

        now = _utcnow()
        entry = LoyaltyLedgerEntry(
            store_id=store_id,
            customer_id=customer_id,
            order_id=order_id,
            entry_type=entry_type,
            points=-points,
            balance_after=new_balance,
            description=description,
            created_at=now,
        )
        db.add(entry)
        if commit:
            db.commit()
            db.refresh(entry)
        else:
            db.flush()
        return entry

    @staticmethod
    def redeem_points_for_coupon(db: Session, store_id: str, customer_id: str, points: int) -> Dict[str, Any]:
        """Désactivé (fidélité v3) : les points se dépensent sur un produit lors de la commande."""
        raise ValueError("L'échange de points contre un bon d'achat n'existe plus : utilisez vos points sur un produit au moment de la commande.")
        points = int(points or 0)
        if points < REDEEM_MIN_POINTS:
            raise ValueError(f"Rachat minimum : {REDEEM_MIN_POINTS} points.")

        store = db.query(Store).filter(Store.id == store_id).first()
        if store is not None and store.is_loyalty_active is False:
            raise ValueError("Le programme de fidélité est suspendu par la boutique.")

        amount = points * REDEEM_FCFA_PER_POINT
        try:
            entry = LoyaltyService.debit_points(
                db, store_id, customer_id, points,
                entry_type="REDEEMED_COUPON",
                description=f"{points} points échangés contre un bon de {amount} FCFA",
                commit=False,
            )
            code = None
            for _ in range(5):
                candidate = "FID-" + secrets.token_hex(4).upper()
                if not db.query(LoyaltyRewardCoupon).filter(
                    LoyaltyRewardCoupon.store_id == store_id, LoyaltyRewardCoupon.code == candidate
                ).first():
                    code = candidate
                    break
            if not code:
                raise ValueError("Impossible de générer le bon, réessayez.")

            coupon = LoyaltyRewardCoupon(
                store_id=store_id,
                customer_id=customer_id,
                code=code,
                title=f"Bon fidélité {amount} FCFA",
                discount_percent=0,
                discount_amount=amount,
                min_order_amount=0,
                expires_at=_utcnow() + timedelta(days=REDEEM_COUPON_VALIDITY_DAYS),
                created_at=_utcnow(),
            )
            db.add(coupon)
            db.commit()
        except Exception:
            db.rollback()
            raise
        db.refresh(entry)
        db.refresh(coupon)
        return {
            "coupon": {
                "id": coupon.id,
                "code": coupon.code,
                "title": coupon.title,
                "discount_amount": coupon.discount_amount,
                "expires_at": coupon.expires_at.isoformat() if coupon.expires_at else None,
            },
            "points_spent": points,
            "balance_after": entry.balance_after,
        }

    @staticmethod
    def get_ledger_history(db: Session, customer_id: str, store_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Return chronological ledger history for customer."""
        q = db.query(LoyaltyLedgerEntry).filter(LoyaltyLedgerEntry.customer_id == customer_id)
        if store_id:
            q = q.filter(LoyaltyLedgerEntry.store_id == store_id)
        entries = q.order_by(LoyaltyLedgerEntry.created_at.desc()).limit(limit).all()
        return [
            {
                "id": e.id,
                "store_id": e.store_id,
                "order_id": e.order_id,
                "entry_type": e.entry_type,
                "points": e.points,
                "balance_after": e.balance_after,
                "description": e.description,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "expires_at": e.expires_at.isoformat() if e.expires_at else None,
            }
            for e in entries
        ]

    @staticmethod
    def get_active_coupons(db: Session, customer_id: str, store_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return unexpired, unused coupons for a customer."""
        now = _utcnow()
        q = db.query(LoyaltyRewardCoupon).filter(
            (LoyaltyRewardCoupon.customer_id == customer_id) | (LoyaltyRewardCoupon.customer_id == None),
            LoyaltyRewardCoupon.is_used == False,
        )
        if store_id:
            q = q.filter(LoyaltyRewardCoupon.store_id == store_id)
        coupons = q.order_by(LoyaltyRewardCoupon.created_at.desc()).all()
        valid = []
        for c in coupons:
            if c.expires_at and _naive_utc(c.expires_at) < now:
                continue
            valid.append({
                "id": c.id,
                "store_id": c.store_id,
                "code": c.code,
                "title": c.title,
                "discount_percent": c.discount_percent,
                "discount_amount": c.discount_amount,
                "min_order_amount": c.min_order_amount,
                "expires_at": c.expires_at.isoformat() if c.expires_at else None,
            })
        return valid

    @staticmethod
    def validate_coupon(db: Session, store_id: str, code: str, order_amount: int = 0, customer_id: Optional[str] = None) -> Dict[str, Any]:
        """Validate coupon code and compute discount.

        Un coupon nominatif (customer_id renseigné) n'est valable que pour son titulaire.
        """
        code = (code or "").strip().upper()
        now = _utcnow()
        coupon = db.query(LoyaltyRewardCoupon).filter(
            LoyaltyRewardCoupon.store_id == store_id,
            LoyaltyRewardCoupon.code == code,
            LoyaltyRewardCoupon.is_used == False,
        ).first()

        if not coupon:
            return {"valid": False, "message": "Code promo invalide ou déjà utilisé."}

        if coupon.customer_id and coupon.customer_id != customer_id:
            return {"valid": False, "message": "Ce coupon est réservé à son titulaire (connectez-vous pour l'utiliser)."}

        if coupon.expires_at and _naive_utc(coupon.expires_at) < now:
            return {"valid": False, "message": "Ce coupon a expiré."}

        if coupon.min_order_amount and order_amount < coupon.min_order_amount:
            return {
                "valid": False,
                "message": f"Montant minimum de commande : {coupon.min_order_amount} FCFA.",
            }

        discount = 0
        if coupon.discount_percent > 0:
            discount = int((order_amount * coupon.discount_percent) / 100)
        elif coupon.discount_amount > 0:
            discount = min(order_amount, coupon.discount_amount)

        return {
            "valid": True,
            "code": coupon.code,
            "title": coupon.title,
            "discount_percent": coupon.discount_percent,
            "discount_amount": discount,
            "coupon_id": coupon.id,
        }
