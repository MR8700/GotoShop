from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.database import get_db
from app.services.call_service import CallService

router = APIRouter(prefix="/calls", tags=["Calls (Voice & Video)"])

class StartCallRequest(BaseModel):
    conversation_id: str
    caller_type: str = "CUSTOMER" # CUSTOMER, MERCHANT
    caller_name: str
    call_type: str = "AUDIO" # AUDIO, VIDEO
    caller_id: Optional[str] = None

class RejectCallRequest(BaseModel):
    reason: Optional[str] = "DECLINED"


@router.post("", summary="Démarrer un appel vocal ou vidéo WebRTC")
def start_call(req: StartCallRequest, db: Session = Depends(get_db)):
    try:
        return CallService.start_call(
            db=db,
            conversation_id=req.conversation_id,
            caller_type=req.caller_type,
            caller_name=req.caller_name,
            call_type=req.call_type,
            caller_id=req.caller_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/answer", summary="Accepter un appel entrant")
def answer_call(call_id: str, db: Session = Depends(get_db)):
    try:
        return CallService.answer_call(db=db, call_id=call_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/reject", summary="Refuser un appel entrant")
def reject_call(call_id: str, req: Optional[RejectCallRequest] = None, db: Session = Depends(get_db)):
    try:
        reason = req.reason if req else "DECLINED"
        return CallService.reject_call(db=db, call_id=call_id, reason=reason)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{call_id}/end", summary="Raccrocher / Terminer l'appel")
def end_call(call_id: str, db: Session = Depends(get_db)):
    try:
        return CallService.end_call(db=db, call_id=call_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", summary="Consulter l'historique des appels (vocaux et vidéos)")
def get_call_history(
    conversation_id: Optional[str] = Query(None),
    store_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return CallService.list_calls(
        db=db,
        conversation_id=conversation_id,
        store_id=store_id,
        limit=limit
    )
