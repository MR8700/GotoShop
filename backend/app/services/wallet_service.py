import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.config import settings
from app.models.wallet import MerchantWallet, WalletTransaction
from app.models.notifications import StoreNotification

class WalletService:
    @staticmethod
    def get_or_create_wallet(db: Session, store_id: str) -> MerchantWallet:
        """Fetch existing merchant wallet or initialize a new one."""
        wallet = db.query(MerchantWallet).filter(MerchantWallet.store_id == store_id).first()
        if not wallet:
            wallet = MerchantWallet(
                store_id=store_id,
                available_balance=0,
                pending_balance=0,
                total_withdrawn=0,
                total_earned=0,
                currency="XOF",
            )
            db.add(wallet)
            db.commit()
            db.refresh(wallet)
        return wallet

    @staticmethod
    def credit_escrow(db: Session, store_id: str, order_id: str, amount: int, note: Optional[str] = None) -> WalletTransaction:
        """Hold payment in escrow (séquestre) upon online payment."""
        if amount <= 0:
            raise ValueError("Le montant de mise en séquestre doit être supérieur à zéro.")

        wallet = WalletService.get_or_create_wallet(db, store_id)
        
        # Idempotency check: don't double credit escrow for the same order
        existing = db.query(WalletTransaction).filter(
            WalletTransaction.store_id == store_id,
            WalletTransaction.order_id == order_id,
            WalletTransaction.transaction_type == "ESCROW_CREDIT",
        ).first()
        if existing:
            return existing

        bal_before = wallet.pending_balance
        wallet.pending_balance += amount
        bal_after = wallet.pending_balance

        tx = WalletTransaction(
            wallet_id=wallet.id,
            store_id=store_id,
            order_id=order_id,
            transaction_type="ESCROW_CREDIT",
            amount=amount,
            fee=0,
            status="COMPLETED",
            balance_before=bal_before,
            balance_after=bal_after,
            reference=f"ESC-{uuid.uuid4().hex[:8].upper()}",
            note=note or f"Paiement commande #{order_id[-6:]} mis en séquestre",
        )
        db.add(tx)

        notif = StoreNotification(
            store_id=store_id,
            notification_type="SYSTEM",
            title="Paiement en séquestre",
            message=f"{amount:,} FCFA ont été reçus et placés en séquestre pour la commande #{order_id[-6:]}.",
        )
        db.add(notif)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def release_escrow(db: Session, store_id: str, order_id: str) -> Optional[WalletTransaction]:
        """Release funds from escrow into available balance once delivery is confirmed."""
        wallet = WalletService.get_or_create_wallet(db, store_id)

        # Check if already released
        already_released = db.query(WalletTransaction).filter(
            WalletTransaction.store_id == store_id,
            WalletTransaction.order_id == order_id,
            WalletTransaction.transaction_type == "ESCROW_RELEASE",
        ).first()
        if already_released:
            return already_released

        # Find the original escrow credit
        credit_tx = db.query(WalletTransaction).filter(
            WalletTransaction.store_id == store_id,
            WalletTransaction.order_id == order_id,
            WalletTransaction.transaction_type == "ESCROW_CREDIT",
        ).first()

        if not credit_tx:
            # Order was COD or not paid via escrow
            return None

        amount = credit_tx.amount
        commission_rate = getattr(settings, "WALLET_COMMISSION_RATE", 0.0)
        fee = int(amount * commission_rate)
        net_amount = amount - fee

        wallet.pending_balance = max(0, wallet.pending_balance - amount)
        bal_before = wallet.available_balance
        wallet.available_balance += net_amount
        wallet.total_earned += net_amount
        bal_after = wallet.available_balance

        tx = WalletTransaction(
            wallet_id=wallet.id,
            store_id=store_id,
            order_id=order_id,
            transaction_type="ESCROW_RELEASE",
            amount=net_amount,
            fee=fee,
            status="COMPLETED",
            balance_before=bal_before,
            balance_after=bal_after,
            reference=f"REL-{uuid.uuid4().hex[:8].upper()}",
            note=f"Fonds libérés suite à livraison commande #{order_id[-6:]}",
        )
        db.add(tx)

        notif = StoreNotification(
            store_id=store_id,
            notification_type="SYSTEM",
            title="Fonds disponibles pour retrait",
            message=f"{net_amount:,} FCFA sont maintenant disponibles pour retrait suite à la livraison #{order_id[-6:]}.",
        )
        db.add(notif)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def refund_escrow(db: Session, store_id: str, order_id: str, reason: Optional[str] = None) -> Optional[WalletTransaction]:
        """Refund escrow if order is cancelled before delivery."""
        wallet = WalletService.get_or_create_wallet(db, store_id)

        credit_tx = db.query(WalletTransaction).filter(
            WalletTransaction.store_id == store_id,
            WalletTransaction.order_id == order_id,
            WalletTransaction.transaction_type == "ESCROW_CREDIT",
        ).first()

        if not credit_tx:
            return None

        already_refunded = db.query(WalletTransaction).filter(
            WalletTransaction.store_id == store_id,
            WalletTransaction.order_id == order_id,
            WalletTransaction.transaction_type == "REFUND",
        ).first()
        if already_refunded:
            return already_refunded

        amount = credit_tx.amount
        wallet.pending_balance = max(0, wallet.pending_balance - amount)

        tx = WalletTransaction(
            wallet_id=wallet.id,
            store_id=store_id,
            order_id=order_id,
            transaction_type="REFUND",
            amount=amount,
            fee=0,
            status="COMPLETED",
            balance_before=wallet.available_balance,
            balance_after=wallet.available_balance,
            reference=f"REF-{uuid.uuid4().hex[:8].upper()}",
            note=reason or f"Remboursement commande annulée #{order_id[-6:]}",
        )
        db.add(tx)

        notif = StoreNotification(
            store_id=store_id,
            notification_type="SYSTEM",
            title="Séquestre remboursé",
            message=f"Commande annulée : {amount:,} FCFA remboursés pour #{order_id[-6:]}.",
        )
        db.add(notif)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def request_withdrawal(
        db: Session,
        store_id: str,
        amount: int,
        payout_phone: str,
        payout_operator: str = "ORANGE",
        note: Optional[str] = None,
    ) -> WalletTransaction:
        """Create a payout withdrawal request against available balance."""
        if amount <= 0:
            raise ValueError("Le montant de retrait doit être supérieur à zéro.")

        wallet = WalletService.get_or_create_wallet(db, store_id)

        if amount > wallet.available_balance:
            raise ValueError(f"Solde insuffisant ({wallet.available_balance:,} FCFA disponibles, {amount:,} demandés).")

        bal_before = wallet.available_balance
        wallet.available_balance -= amount
        wallet.total_withdrawn += amount
        bal_after = wallet.available_balance
        wallet.payout_phone = payout_phone
        wallet.payout_operator = payout_operator

        tx = WalletTransaction(
            wallet_id=wallet.id,
            store_id=store_id,
            transaction_type="WITHDRAWAL_REQUEST",
            amount=amount,
            fee=0,
            status="PENDING",
            balance_before=bal_before,
            balance_after=bal_after,
            reference=f"WTH-{uuid.uuid4().hex[:8].upper()}",
            note=f"Demande retrait vers {payout_operator} ({payout_phone})" + (f": {note}" if note else ""),
        )
        db.add(tx)

        notif = StoreNotification(
            store_id=store_id,
            notification_type="SYSTEM",
            title="Demande de retrait initiée",
            message=f"Demande de retrait de {amount:,} FCFA transmise. En cours de validation.",
        )
        db.add(notif)
        db.commit()
        db.refresh(tx)
        return tx

    @staticmethod
    def get_wallet_summary(db: Session, store_id: str) -> Dict[str, Any]:
        """Get comprehensive merchant wallet summary with recent transactions."""
        wallet = WalletService.get_or_create_wallet(db, store_id)
        txs = db.query(WalletTransaction).filter(
            WalletTransaction.store_id == store_id
        ).order_by(WalletTransaction.created_at.desc()).limit(30).all()

        return {
            "id": wallet.id,
            "store_id": wallet.store_id,
            "available_balance": wallet.available_balance,
            "pending_balance": wallet.pending_balance,
            "total_withdrawn": wallet.total_withdrawn,
            "total_earned": wallet.total_earned,
            "currency": wallet.currency,
            "payout_phone": wallet.payout_phone,
            "payout_operator": wallet.payout_operator,
            "transactions": [
                {
                    "id": t.id,
                    "reference": t.reference,
                    "type": t.transaction_type,
                    "amount": t.amount,
                    "fee": t.fee,
                    "status": t.status,
                    "balance_before": t.balance_before,
                    "balance_after": t.balance_after,
                    "note": t.note,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in txs
            ],
        }
