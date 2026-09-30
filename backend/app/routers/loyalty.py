"""Public loyalty card verification (no login: a shopkeeper or a scanner must be able to use it)."""
import time
from collections import defaultdict, deque
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.card_service import verify_card
from app.services.customer_service import CustomerService

router = APIRouter(prefix="/loyalty", tags=["Loyalty cards"])

# Tiny in-memory throttle against brute-forcing codes (per client IP).
_WINDOW_SECONDS = 60
_MAX_ATTEMPTS = 30
_attempts = defaultdict(deque)


def _throttle(request: Request) -> None:
    fwd = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    ip = fwd or (request.client.host if request.client else "unknown")
    now = time.time()
    q = _attempts[ip]
    while q and now - q[0] > _WINDOW_SECONDS:
        q.popleft()
    if len(q) >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Trop de vérifications, réessayez dans une minute.")
    q.append(now)


@router.get("/verify/{card_no}/{code}", summary="Vérifier l'authenticité d'une carte de fidélité")
def verify_loyalty_card(card_no: str, code: str, request: Request, db: Session = Depends(get_db)):
    _throttle(request)
    return verify_card(db, card_no, code, stats_fn=CustomerService.get_customer_stats)
