import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_

from app.models.chat import Conversation, ConversationParticipant, ChatMessage, MessageAttachment
from app.models.order import Order
from app.models.store import Store
from app.models.customer import Customer
from app.realtime.connection_manager import manager

class ChatService:
    @staticmethod
    def get_or_create_conversation(
        db: Session,
        store_id: str,
        context_type: str = "GENERAL_STORE",
        order_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_token: Optional[str] = None,
        customer_name: Optional[str] = None,
        customer_avatar_url: Optional[str] = None
    ) -> Conversation:
        # Check if conversation already exists for this order
        if order_id:
            existing = db.query(Conversation).filter(
                Conversation.order_id == order_id
            ).first()
            if existing:
                return existing

        # For general store conversation with specific customer
        if context_type == "GENERAL_STORE":
            query = db.query(Conversation).filter(
                Conversation.store_id == store_id,
                Conversation.context_type == "GENERAL_STORE",
                Conversation.order_id.is_(None)
            )
            if customer_id:
                query = query.filter(Conversation.customer_id == customer_id)
            elif customer_token:
                query = query.filter(Conversation.customer_token == customer_token)
            
            existing = query.first()
            if existing:
                return existing

        store = db.query(Store).filter(Store.id == store_id).first()
        store_name = store.name if store else "Boutique"

        title = f"Commande #{order_id}" if order_id else f"Discussion avec {store_name}"
        if order_id:
            order = db.query(Order).filter(Order.id == order_id).first()
            if order:
                title = f"Commande #{order.order_number}"
                if not customer_name:
                    customer_name = order.customer_name

        conv = Conversation(
            id=str(uuid.uuid4()),
            store_id=store_id,
            order_id=order_id,
            context_type=context_type,
            title=title,
            customer_id=customer_id,
            customer_token=customer_token,
            customer_name=customer_name or "Client",
            customer_avatar_url=customer_avatar_url,
            last_message_at=datetime.utcnow(),
            last_message_preview="Conversation démarrée"
        )
        db.add(conv)
        db.flush()

        # Add participants: Customer & Merchant
        cust_part = ConversationParticipant(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            user_type="CUSTOMER",
            user_id=customer_id or customer_token,
            display_name=customer_name or "Client",
            avatar_url=customer_avatar_url,
            last_read_at=datetime.utcnow()
        )
        db.add(cust_part)

        store_part = ConversationParticipant(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            user_type="MERCHANT",
            user_id=store.owner_id if store else None,
            display_name=store_name,
            avatar_url=store.avatar_url if store else None,
            last_read_at=datetime.utcnow()
        )
        db.add(store_part)

        db.commit()
        db.refresh(conv)
        return conv

    @staticmethod
    def list_conversations(
        db: Session,
        store_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_token: Optional[str] = None,
        context_filter: Optional[str] = None, # "ALL", "BOUTIQUE", "ORDER"
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = db.query(Conversation)

        if store_id:
            query = query.filter(Conversation.store_id == store_id)
        elif customer_id:
            query = query.filter(Conversation.customer_id == customer_id)
        elif customer_token:
            query = query.filter(
                or_(
                    Conversation.customer_token == customer_token,
                    Conversation.customer_id.in_(
                        db.query(Customer.id).filter(Customer.session_token == customer_token)
                    )
                )
            )

        if context_filter == "ORDER":
            query = query.filter(Conversation.context_type == "ORDER")
        elif context_filter == "BOUTIQUE":
            query = query.filter(Conversation.context_type == "GENERAL_STORE")

        if search:
            query = query.filter(
                or_(
                    Conversation.title.ilike(f"%{search}%"),
                    Conversation.customer_name.ilike(f"%{search}%"),
                    Conversation.last_message_preview.ilike(f"%{search}%")
                )
            )

        conversations = query.order_by(desc(Conversation.last_message_at)).all()

        results = []
        for c in conversations:
            store = db.query(Store).filter(Store.id == c.store_id).first()
            order = db.query(Order).filter(Order.id == c.order_id).first() if c.order_id else None
            unread_count = 0
            # Calculate unread
            participants = db.query(ConversationParticipant).filter(ConversationParticipant.conversation_id == c.id).all()
            
            results.append({
                "id": c.id,
                "store_id": c.store_id,
                "store_name": store.name if store else "Boutique",
                "store_avatar_url": store.avatar_url if store else None,
                "store_slug": store.slug if store else None,
                "order_id": c.order_id,
                "order_number": order.order_number if order else None,
                "order_status": order.status if order else None,
                "order_payment_status": order.payment_status if order else None,
                "order_total": order.total_amount if order else None,
                "context_type": c.context_type,
                "title": c.title,
                "customer_name": c.customer_name,
                "customer_avatar_url": c.customer_avatar_url,
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "last_message_preview": c.last_message_preview,
                "is_archived": c.is_archived,
                "unread_count": unread_count,
            })
        return results

    @staticmethod
    def get_conversation_detail(db: Session, conversation_id: str) -> Optional[Dict[str, Any]]:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            return None

        store = db.query(Store).filter(Store.id == conv.store_id).first()
        order = db.query(Order).filter(Order.id == conv.order_id).first() if conv.order_id else None

        order_data = None
        if order:
            from app.services.order_service import OrderService
            order_data = OrderService.format_order_dict(order)

        participants = db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == conv.id
        ).all()

        return {
            "id": conv.id,
            "store_id": conv.store_id,
            "store": {
                "id": store.id if store else None,
                "name": store.name if store else "",
                "slug": store.slug if store else "",
                "avatar_url": store.avatar_url if store else None,
                "tagline": store.tagline if store else "",
                "currency": store.currency if store else "FCFA",
                "rating": store.rating if store else 4.9,
                "contact_whatsapp": store.contact_whatsapp if store else "",
            } if store else None,
            "order_id": conv.order_id,
            "order": order_data,
            "context_type": conv.context_type,
            "title": conv.title,
            "customer_name": conv.customer_name,
            "customer_avatar_url": conv.customer_avatar_url,
            "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
            "last_message_preview": conv.last_message_preview,
            "is_archived": conv.is_archived,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "participants": [
                {
                    "id": p.id,
                    "user_type": p.user_type,
                    "display_name": p.display_name,
                    "avatar_url": p.avatar_url,
                    "unread_count": p.unread_count,
                }
                for p in participants
            ]
        }

    @staticmethod
    def list_messages(db: Session, conversation_id: str, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        messages = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conversation_id
        ).order_by(ChatMessage.created_at.asc()).offset(offset).limit(limit).all()

        results = []
        for m in messages:
            attachments = db.query(MessageAttachment).filter(
                MessageAttachment.message_id == m.id
            ).all()

            metadata = {}
            if m.metadata_json:
                try:
                    metadata = json.loads(m.metadata_json)
                except Exception:
                    metadata = {}

            results.append({
                "id": m.id,
                "conversation_id": m.conversation_id,
                "sender_type": m.sender_type,
                "sender_id": m.sender_id,
                "sender_name": m.sender_name,
                "message_type": m.message_type,
                "content": m.content,
                "metadata": metadata,
                "status": m.status,
                "reply_to_id": m.reply_to_id,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "attachments": [
                    {
                        "id": a.id,
                        "file_url": a.file_url,
                        "file_name": a.file_name,
                        "mime_type": a.mime_type,
                        "file_size": a.file_size,
                        "thumbnail_url": a.thumbnail_url,
                        "duration_seconds": a.duration_seconds
                    }
                    for a in attachments
                ]
            })
        return results

    @staticmethod
    def send_message(
        db: Session,
        conversation_id: str,
        sender_type: str,
        sender_name: str,
        content: str,
        sender_id: Optional[str] = None,
        message_type: str = "TEXT",
        metadata: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        reply_to_id: Optional[str] = None
    ) -> Dict[str, Any]:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise ValueError(f"Conversation {conversation_id} not found")

        msg = ChatMessage(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            sender_type=sender_type,
            sender_id=sender_id,
            sender_name=sender_name,
            message_type=message_type,
            content=content,
            metadata_json=json.dumps(metadata) if metadata else None,
            status="SENT",
            reply_to_id=reply_to_id,
            created_at=datetime.utcnow()
        )
        db.add(msg)
        db.flush()

        created_attachments = []
        if attachments:
            for att in attachments:
                att_record = MessageAttachment(
                    id=str(uuid.uuid4()),
                    message_id=msg.id,
                    media_id=att.get("media_id"),
                    file_url=att.get("file_url", ""),
                    file_name=att.get("file_name", "fichier"),
                    mime_type=att.get("mime_type", "application/octet-stream"),
                    file_size=att.get("file_size", 0),
                    thumbnail_url=att.get("thumbnail_url"),
                    duration_seconds=att.get("duration_seconds")
                )
                db.add(att_record)
                created_attachments.append({
                    "id": att_record.id,
                    "file_url": att_record.file_url,
                    "file_name": att_record.file_name,
                    "mime_type": att_record.mime_type,
                    "file_size": att_record.file_size,
                    "thumbnail_url": att_record.thumbnail_url,
                    "duration_seconds": att_record.duration_seconds
                })

        # Update conversation last activity & preview
        preview_text = content
        if message_type == "AUDIO":
            preview_text = "🎙 Note vocale"
        elif message_type == "IMAGE":
            preview_text = "📷 Photo"
        elif message_type == "LOCATION":
            preview_text = "📍 Localisation partagée"
        elif message_type == "PAYMENT_PROOF":
            preview_text = "💳 Preuve de paiement envoyée"
        elif message_type == "ORDER":
            preview_text = "📦 Détail de la commande"
        elif message_type == "CALL_EVENT":
            preview_text = f"📞 {content}"

        conv.last_message_at = datetime.utcnow()
        conv.last_message_preview = preview_text[:250]

        # Increment unread count for recipients
        participants = db.query(ConversationParticipant).filter(
            ConversationParticipant.conversation_id == conversation_id
        ).all()
        for p in participants:
            if p.user_type != sender_type:
                p.unread_count = (p.unread_count or 0) + 1

        db.commit()
        db.refresh(msg)

        msg_dict = {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_type": msg.sender_type,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender_name,
            "message_type": msg.message_type,
            "content": msg.content,
            "metadata": metadata or {},
            "status": msg.status,
            "reply_to_id": msg.reply_to_id,
            "created_at": msg.created_at.isoformat(),
            "attachments": created_attachments
        }

        return msg_dict

    @staticmethod
    def post_system_message(
        db: Session,
        conversation_id: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return ChatService.send_message(
            db=db,
            conversation_id=conversation_id,
            sender_type="SYSTEM",
            sender_name="Système",
            content=content,
            message_type="SYSTEM",
            metadata=metadata
        )
