from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app.routers.auth import require_store_admin
from app.services.store_service import StoreService
from app.services.wallet_service import WalletService

router = APIRouter(prefix="/merchant/wallet", tags=["Merchant Wallet"])


class WithdrawalRequestSchema(BaseModel):
    amount: int = Field(..., gt=0, description="Montant à retirer en FCFA")
    payout_phone: str = Field(..., min_length=8, description="Numéro bénéficiaire")
    payout_operator: str = Field("ORANGE", description="Opérateur (ORANGE, MOOV, WAVE, LIGDICASH)")
    note: Optional[str] = None


@router.get("", summary="Consulter le portefeuille commerçant")
def get_merchant_wallet(
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    store = StoreService.resolve_store(db, slug=slug) if slug else StoreService.get_default_store(db)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    require_store_admin(store.id, authorization, db)
    return WalletService.get_wallet_summary(db, store.id)


@router.post("/withdraw", summary="Initier une demande de retrait")
def request_wallet_withdrawal(
    req: WithdrawalRequestSchema,
    store_slug: Optional[str] = Query(None, alias="store"),
    x_store_slug: Optional[str] = Header(None, alias="X-Store-Slug"),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    slug = x_store_slug or store_slug
    store = StoreService.resolve_store(db, slug=slug) if slug else StoreService.get_default_store(db)
    if not store:
        raise HTTPException(status_code=404, detail="Boutique introuvable")
    require_store_admin(store.id, authorization, db)

    try:
        tx = WalletService.request_withdrawal(
            db=db,
            store_id=store.id,
            amount=req.amount,
            payout_phone=req.payout_phone,
            payout_operator=req.payout_operator,
            note=req.note
        )
        return {
            "success": True,
            "message": "Demande de retrait enregistrée avec succès.",
            "transaction_id": tx.id,
            "reference": tx.reference,
            "amount": tx.amount,
            "status": tx.status
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
