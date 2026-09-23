import json
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.database import get_db, SessionLocal
from app.services.chat_service import ChatService
from app.services.media_service import MediaService
from app.realtime.connection_manager import manager

router = APIRouter(tags=["Conversational Chat"])

class CreateConversationRequest(BaseModel):
    store_id: str
    context_type: str = "GENERAL_STORE" # GENERAL_STORE, ORDER, SUPPORT
    order_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_token: Optional[str] = None
    customer_name: Optional[str] = None
    customer_avatar_url: Optional[str] = None

class SendMessageRequest(BaseModel):
    sender_type: str # CUSTOMER, MERCHANT, SYSTEM
    sender_name: str
    content: str
    sender_id: Optional[str] = None
    message_type: str = "TEXT" # TEXT, LOCATION, ORDER, PAYMENT_PROOF, SYSTEM, CALL_EVENT, AUDIO, IMAGE, VIDEO
    metadata: Optional[Dict[str, Any]] = None
    attachments: Optional[List[Dict[str, Any]]] = None
    reply_to_id: Optional[str] = None

class MarkReadRequest(BaseModel):
    user_type: str # CUSTOMER, MERCHANT
    user_id: Optional[str] = None


@router.get("/conversations", summary="Lister les conversations")
def list_conversations(
    store_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    customer_token: Optional[str] = Query(None),
    context_filter: Optional[str] = Query(None), # ALL, BOUTIQUE, ORDER
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return ChatService.list_conversations(
        db=db,
        store_id=store_id,
        customer_id=customer_id,
        customer_token=customer_token,
        context_filter=context_filter,
        search=search
    )


@router.post("/conversations", summary="Créer ou récupérer une conversation")
def get_or_create_conversation(req: CreateConversationRequest, db: Session = Depends(get_db)):
    try:
        conv = ChatService.get_or_create_conversation(
            db=db,
            store_id=req.store_id,
            context_type=req.context_type,
            order_id=req.order_id,
            customer_id=req.customer_id,
            customer_token=req.customer_token,
            customer_name=req.customer_name,
            customer_avatar_url=req.customer_avatar_url
        )
        return ChatService.get_conversation_detail(db=db, conversation_id=conv.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/conversations/{conversation_id}", summary="Détail d'une conversation")
def get_conversation_detail(conversation_id: str, db: Session = Depends(get_db)):
    conv = ChatService.get_conversation_detail(db=db, conversation_id=conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation introuvable")
    return conv


@router.get("/conversations/{conversation_id}/messages", summary="Historique des messages d'une conversation")
def get_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    return ChatService.list_messages(db=db, conversation_id=conversation_id, limit=limit, offset=offset)


@router.post("/conversations/{conversation_id}/messages", summary="Envoyer un message dans une conversation")
async def send_message(conversation_id: str, req: SendMessageRequest, db: Session = Depends(get_db)):
    try:
        msg = ChatService.send_message(
            db=db,
            conversation_id=conversation_id,
            sender_type=req.sender_type,
            sender_name=req.sender_name,
            content=req.content,
            sender_id=req.sender_id,
            message_type=req.message_type,
            metadata=req.metadata,
            attachments=req.attachments,
            reply_to_id=req.reply_to_id
        )

        # Broadcast via WebSocket
        await manager.broadcast_to_conversation(conversation_id, {
            "type": "message.created",
            "message": msg
        })

        return msg
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/conversations/{conversation_id}/media", summary="Téléverser un média (audio, photo, fichier) et l'envoyer comme message")
async def upload_and_send_media(
    conversation_id: str,
    file: UploadFile = File(...),
    sender_type: str = Form("CUSTOMER"),
    sender_name: str = Form("Client"),
    sender_id: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    duration_seconds: Optional[float] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        # Save media file
        media_res = await MediaService.save_upload_file(
            db=db,
            upload_file=file,
            owner_id=sender_id,
            duration_seconds=duration_seconds
        )

        # Determine message type
        msg_type = media_res["media_type"] # IMAGE, AUDIO, VIDEO, DOCUMENT
        text_content = caption or ("🎙 Note vocale" if msg_type == "AUDIO" else f"📎 {media_res['file_name']}")

        metadata = {
            "media_id": media_res["id"],
            "mime_type": media_res["mime_type"],
            "file_size": media_res["file_size"],
            "file_url": media_res["file_url"],
            "duration_seconds": media_res["duration_seconds"]
        }

        msg = ChatService.send_message(
            db=db,
            conversation_id=conversation_id,
            sender_type=sender_type,
            sender_name=sender_name,
            sender_id=sender_id,
            content=text_content,
            message_type=msg_type,
            metadata=metadata,
            attachments=[{
                "media_id": media_res["id"],
                "file_url": media_res["file_url"],
                "file_name": media_res["file_name"],
                "mime_type": media_res["mime_type"],
                "file_size": media_res["file_size"],
                "duration_seconds": media_res["duration_seconds"]
            }]
        )

        await manager.broadcast_to_conversation(conversation_id, {
            "type": "message.created",
            "message": msg
        })

        return msg
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/conversations/{conversation_id}/read", summary="Marquer les messages de la conversation comme lus")
async def mark_read(conversation_id: str, req: MarkReadRequest, db: Session = Depends(get_db)):
    from app.models.chat import ConversationParticipant
    participants = db.query(ConversationParticipant).filter(
        ConversationParticipant.conversation_id == conversation_id
    ).all()

    for p in participants:
        if p.user_type == req.user_type or (req.user_id and p.user_id == req.user_id):
            p.unread_count = 0
    db.commit()

    await manager.broadcast_to_conversation(conversation_id, {
        "type": "message.read",
        "conversation_id": conversation_id,
        "user_type": req.user_type,
        "user_id": req.user_id
    })
    return {"status": "ok", "conversation_id": conversation_id}


# Real-time WebSocket connection
@router.websocket("/ws/chat/{conversation_id}")
async def chat_websocket(
    websocket: WebSocket,
    conversation_id: str,
    user_id: Optional[str] = Query(None),
    user_name: Optional[str] = Query(None),
    role: Optional[str] = Query("customer")
):
    await manager.connect_conversation(
        websocket=websocket,
        conversation_id=conversation_id,
        user_id=user_id,
        user_name=user_name,
        role=role or "customer"
    )

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except Exception:
                continue

            event_type = data.get("type")

            # 1. Typing status event
            if event_type in ["typing.started", "typing.stopped", "typing"]:
                is_typing = data.get("is_typing", event_type == "typing.started")
                await manager.handle_typing(
                    conversation_id=conversation_id,
                    user_id=data.get("user_id", user_id or "anon"),
                    user_name=data.get("user_name", user_name or "Utilisateur"),
                    is_typing=is_typing,
                    sender_ws=websocket
                )

            # 2. Text message via WebSocket
            elif event_type == "message.send":
                db = SessionLocal()
                try:
                    msg = ChatService.send_message(
                        db=db,
                        conversation_id=conversation_id,
                        sender_type=data.get("sender_type", "CUSTOMER"),
                        sender_name=data.get("sender_name", user_name or "Client"),
                        sender_id=data.get("sender_id", user_id),
                        content=data.get("content", ""),
                        message_type=data.get("message_type", "TEXT"),
                        metadata=data.get("metadata"),
                        attachments=data.get("attachments")
                    )
                    await manager.broadcast_to_conversation(conversation_id, {
                        "type": "message.created",
                        "message": msg
                    })
                finally:
                    db.close()

            # 3. WebRTC signaling relay (offer, answer, candidate)
            elif event_type == "webrtc.signal":
                await manager.relay_webrtc(
                    conversation_id=conversation_id,
                    sender_ws=websocket,
                    signal_data=data.get("signal", {})
                )

            # 4. Heartbeat ping-pong
            elif event_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        manager.disconnect_conversation(websocket)
    except Exception:
        manager.disconnect_conversation(websocket)
