import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.call import CallSession
from app.models.chat import Conversation
from app.models.audit import AuditLog
from app.services.chat_service import ChatService
from app.realtime.connection_manager import manager

class CallService:
    @staticmethod
    def start_call(
        db: Session,
        conversation_id: str,
        caller_type: str,
        caller_name: str,
        call_type: str = "AUDIO", # AUDIO or VIDEO
        caller_id: Optional[str] = None
    ) -> Dict[str, Any]:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise ValueError(f"Conversation {conversation_id} not found")

        # Determine callee
        if caller_type == "CUSTOMER":
            callee_type = "MERCHANT"
            callee_id = conv.store_id
            callee_name = conv.store.name if conv.store else "Commerçant"
        else:
            callee_type = "CUSTOMER"
            callee_id = conv.customer_id or conv.customer_token
            callee_name = conv.customer_name or "Client"

        call = CallSession(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            store_id=conv.store_id,
            caller_type=caller_type,
            caller_id=caller_id,
            caller_name=caller_name,
            callee_type=callee_type,
            callee_id=callee_id,
            callee_name=callee_name,
            call_type=call_type,
            status="RINGING",
            started_at=datetime.utcnow()
        )
        db.add(call)

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="CALL_STARTED",
            actor_type=caller_type,
            actor_id=caller_id,
            actor_name=caller_name,
            resource_type="CALL",
            resource_id=call.id,
            previous_state=None,
            new_state="RINGING",
            metadata_json=json.dumps({"call_type": call_type, "conversation_id": conversation_id})
        )
        db.add(audit)
        db.commit()
        db.refresh(call)

        call_data = {
            "id": call.id,
            "conversation_id": call.conversation_id,
            "caller_type": call.caller_type,
            "caller_name": call.caller_name,
            "callee_type": call.callee_type,
            "callee_name": call.callee_name,
            "call_type": call.call_type,
            "status": call.status,
            "started_at": call.started_at.isoformat()
        }

        # Broadcast incoming call to the conversation room
        manager.safe_broadcast_sync(conversation_id, {
            "type": "call.incoming",
            "call": call_data
        })

        return call_data

    @staticmethod
    def answer_call(db: Session, call_id: str) -> Dict[str, Any]:
        call = db.query(CallSession).filter(CallSession.id == call_id).first()
        if not call:
            raise ValueError(f"Call {call_id} not found")

        call.status = "ACCEPTED"
        call.answered_at = datetime.utcnow()
        db.commit()

        call_data = {
            "id": call.id,
            "status": call.status,
            "answered_at": call.answered_at.isoformat()
        }

        manager.safe_broadcast_sync(call.conversation_id, {
            "type": "call.accepted",
            "call_id": call.id
        })

        return call_data

    @staticmethod
    def reject_call(db: Session, call_id: str, reason: str = "DECLINED") -> Dict[str, Any]:
        call = db.query(CallSession).filter(CallSession.id == call_id).first()
        if not call:
            raise ValueError(f"Call {call_id} not found")

        call.status = "REJECTED" if reason == "DECLINED" else "MISSED"
        call.ended_at = datetime.utcnow()
        db.commit()

        # Post call event message in conversation
        call_label = "vocal" if call.call_type == "AUDIO" else "vidéo"
        content = f"Appel {call_label} manqué ou refusé"
        ChatService.send_message(
            db=db,
            conversation_id=call.conversation_id,
            sender_type="SYSTEM",
            sender_name="Système",
            content=content,
            message_type="CALL_EVENT",
            metadata={"call_id": call.id, "call_type": call.call_type, "status": call.status, "duration_seconds": 0}
        )

        manager.safe_broadcast_sync(call.conversation_id, {
            "type": "call.rejected",
            "call_id": call.id,
            "reason": reason
        })

        return {"id": call.id, "status": call.status}

    @staticmethod
    def end_call(db: Session, call_id: str) -> Dict[str, Any]:
        call = db.query(CallSession).filter(CallSession.id == call_id).first()
        if not call:
            raise ValueError(f"Call {call_id} not found")

        now = datetime.utcnow()
        call.status = "ENDED"
        call.ended_at = now

        if call.answered_at:
            duration = int((now - call.answered_at).total_seconds())
        else:
            duration = 0
        call.duration_seconds = max(0, duration)
        db.commit()

        # Format duration string (e.g. 14 min 20 s)
        mins = call.duration_seconds // 60
        secs = call.duration_seconds % 60
        dur_str = f"{mins} min {secs} s" if mins > 0 else f"{secs} s"
        call_label = "vocal" if call.call_type == "AUDIO" else "vidéo"

        ChatService.send_message(
            db=db,
            conversation_id=call.conversation_id,
            sender_type="SYSTEM",
            sender_name="Système",
            content=f"Appel {call_label} terminé • Durée : {dur_str}",
            message_type="CALL_EVENT",
            metadata={
                "call_id": call.id,
                "call_type": call.call_type,
                "status": "ENDED",
                "duration_seconds": call.duration_seconds,
                "duration_formatted": dur_str
            }
        )

        audit = AuditLog(
            id=str(uuid.uuid4()),
            event_name="CALL_ENDED",
            actor_type=call.caller_type,
            actor_id=call.caller_id,
            actor_name=call.caller_name,
            resource_type="CALL",
            resource_id=call.id,
            previous_state="ACCEPTED",
            new_state="ENDED",
            metadata_json=json.dumps({"duration_seconds": call.duration_seconds})
        )
        db.add(audit)
        db.commit()

        manager.safe_broadcast_sync(call.conversation_id, {
            "type": "call.ended",
            "call_id": call.id,
            "duration_seconds": call.duration_seconds
        })

        return {
            "id": call.id,
            "status": "ENDED",
            "duration_seconds": call.duration_seconds,
            "duration_formatted": dur_str
        }

    @staticmethod
    def list_calls(
        db: Session,
        conversation_id: Optional[str] = None,
        store_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        query = db.query(CallSession)
        if conversation_id:
            query = query.filter(CallSession.conversation_id == conversation_id)
        if store_id:
            query = query.filter(CallSession.store_id == store_id)

        calls = query.order_by(desc(CallSession.started_at)).limit(limit).all()

        results = []
        for c in calls:
            mins = c.duration_seconds // 60
            secs = c.duration_seconds % 60
            dur_str = f"{mins} min {secs} s" if mins > 0 else f"{secs} s"
            results.append({
                "id": c.id,
                "conversation_id": c.conversation_id,
                "store_id": c.store_id,
                "caller_type": c.caller_type,
                "caller_name": c.caller_name,
                "callee_type": c.callee_type,
                "callee_name": c.callee_name,
                "call_type": c.call_type,
                "status": c.status,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "ended_at": c.ended_at.isoformat() if c.ended_at else None,
                "duration_seconds": c.duration_seconds,
                "duration_formatted": dur_str
            })
        return results
