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
    {"name": "Argent", "min_points": 50, "discount_percent": 3, "badge": "silver"},
    {"name": "Or", "min_points": 150, "discount_percent": 5, "badge": "gold"},
    {"name": "Platine", "min_points": 400, "discount_percent": 8, "badge": "platinum"},
]


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
        """Calculate live balance from customer record or ledger."""
        cust = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not cust:
            return 0
        return cust.bonus_points or 0

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

        cust = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not cust:
            raise ValueError("Client introuvable pour cette boutique")

        current_balance = cust.bonus_points or 0
        new_balance = current_balance + points
        cust.bonus_points = new_balance

        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=validity_days)

        entry = LoyaltyLedgerEntry(
            store_id=store_id,
            customer_id=customer_id,
            order_id=order_id,
            entry_type=entry_type,
            points=points,
            balance_after=new_balance,
            description=description,
            expires_at=expires_at,
            created_at=now,
        )
        db.add(entry)

        # Notify customer about points
        notif = StoreNotification(
            store_id=store_id,
            notification_type="SYSTEM",
            title="Points de fidélité crédités !",
            message=f"+{points} points ajoutés à votre compte ! Nouveau solde : {new_balance} pts.",
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
    ) -> LoyaltyLedgerEntry:
        """Debit points from customer if balance allows."""
        if points <= 0:
            raise ValueError("Les points débités doivent être supérieurs à 0")

        cust = db.query(Customer).filter(Customer.id == customer_id, Customer.store_id == store_id).first()
        if not cust:
            raise ValueError("Client introuvable")

        current_balance = cust.bonus_points or 0
        if current_balance < points:
            raise ValueError(f"Solde insuffisant ({current_balance} pts disponibles, {points} demandés)")

        new_balance = current_balance - points
        cust.bonus_points = new_balance

        now = datetime.now(timezone.utc)
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
        db.commit()
        db.refresh(entry)
        return entry

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
        now = datetime.now(timezone.utc)
        q = db.query(LoyaltyRewardCoupon).filter(
            (LoyaltyRewardCoupon.customer_id == customer_id) | (LoyaltyRewardCoupon.customer_id == None),
            LoyaltyRewardCoupon.is_used == False,
        )
        if store_id:
            q = q.filter(LoyaltyRewardCoupon.store_id == store_id)
        coupons = q.order_by(LoyaltyRewardCoupon.created_at.desc()).all()
        valid = []
        for c in coupons:
            if c.expires_at and c.expires_at < now:
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
    def validate_coupon(db: Session, store_id: str, code: str, order_amount: int = 0) -> Dict[str, Any]:
        """Validate coupon code and compute discount."""
        code = (code or "").strip().upper()
        now = datetime.now(timezone.utc)
        coupon = db.query(LoyaltyRewardCoupon).filter(
            LoyaltyRewardCoupon.store_id == store_id,
            LoyaltyRewardCoupon.code == code,
            LoyaltyRewardCoupon.is_used == False,
        ).first()

        if not coupon:
            return {"valid": False, "message": "Code promo invalide ou déjà utilisé."}

        if coupon.expires_at and coupon.expires_at < now:
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
