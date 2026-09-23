import json
import logging
from typing import Dict, Set, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("conversastore.realtime")

class ConnectionManager:
    def __init__(self):
        # conversation_id -> set of WebSocket connections
        self.active_conversations: Dict[str, Set[WebSocket]] = {}
        # user_token / user_id -> set of WebSocket connections (for global notifications)
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        # metadata per websocket
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}
        # presence: store_id -> set of online user identifiers
        self.online_users: Dict[str, Set[str]] = {}
        # typing: conversation_id -> set of user identifiers currently typing
        self.typing_users: Dict[str, Set[str]] = {}

    async def connect_conversation(self, websocket: WebSocket, conversation_id: str, user_id: Optional[str] = None, user_name: Optional[str] = None, role: str = "customer"):
        await websocket.accept()
        if conversation_id not in self.active_conversations:
            self.active_conversations[conversation_id] = set()
        self.active_conversations[conversation_id].add(websocket)
        self.connection_metadata[websocket] = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "user_name": user_name or "Utilisateur",
            "role": role,
        }

        # Broadcast participant presence
        if user_id:
            await self.broadcast_to_conversation(conversation_id, {
                "type": "presence.joined",
                "conversation_id": conversation_id,
                "user_id": user_id,
                "user_name": user_name,
                "role": role
            }, exclude=websocket)

    def disconnect_conversation(self, websocket: WebSocket):
        meta = self.connection_metadata.pop(websocket, None)
        if meta:
            conv_id = meta.get("conversation_id")
            if conv_id and conv_id in self.active_conversations:
                self.active_conversations[conv_id].discard(websocket)
                if not self.active_conversations[conv_id]:
                    del self.active_conversations[conv_id]
            # remove from typing
            user_id = meta.get("user_id")
            if conv_id and user_id and conv_id in self.typing_users:
                self.typing_users[conv_id].discard(user_id)

    async def connect_user(self, websocket: WebSocket, user_token: str):
        await websocket.accept()
        if user_token not in self.user_connections:
            self.user_connections[user_token] = set()
        self.user_connections[user_token].add(websocket)

    def disconnect_user(self, websocket: WebSocket, user_token: str):
        if user_token in self.user_connections:
            self.user_connections[user_token].discard(websocket)
            if not self.user_connections[user_token]:
                del self.user_connections[user_token]

    async def broadcast_to_conversation(self, conversation_id: str, payload: dict, exclude: Optional[WebSocket] = None):
        if conversation_id not in self.active_conversations:
            return
        dead_sockets = set()
        text_data = json.dumps(payload, default=str)
        for ws in self.active_conversations[conversation_id]:
            if ws is exclude:
                continue
            try:
                await ws.send_text(text_data)
            except Exception as e:
                logger.warning(f"Error broadcasting to socket: {e}")
                dead_sockets.add(ws)

        for dead in dead_sockets:
            self.disconnect_conversation(dead)

    async def send_to_user(self, user_token: str, payload: dict):
        if user_token not in self.user_connections:
            return
        dead_sockets = set()
        text_data = json.dumps(payload, default=str)
        for ws in self.user_connections[user_token]:
            try:
                await ws.send_text(text_data)
            except Exception as e:
                logger.warning(f"Error sending to user socket: {e}")
                dead_sockets.add(ws)

        for dead in dead_sockets:
            self.disconnect_user(dead, user_token)

    async def handle_typing(self, conversation_id: str, user_id: str, user_name: str, is_typing: bool, sender_ws: WebSocket):
        if conversation_id not in self.typing_users:
            self.typing_users[conversation_id] = set()
        if is_typing:
            self.typing_users[conversation_id].add(user_id)
        else:
            self.typing_users[conversation_id].discard(user_id)

        await self.broadcast_to_conversation(conversation_id, {
            "type": "typing.status",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "user_name": user_name,
            "is_typing": is_typing,
            "active_typers": list(self.typing_users.get(conversation_id, []))
        }, exclude=sender_ws)

    async def relay_webrtc(self, conversation_id: str, sender_ws: WebSocket, signal_data: dict):
        # Relay WebRTC offer / answer / ice-candidate
        await self.broadcast_to_conversation(conversation_id, {
            "type": "webrtc.signal",
            "conversation_id": conversation_id,
            "signal": signal_data
        }, exclude=sender_ws)

    def safe_broadcast_sync(self, conversation_id: str, payload: dict):
        try:
            import asyncio
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self.broadcast_to_conversation(conversation_id, payload))
            except RuntimeError:
                pass
        except Exception:
            pass

manager = ConnectionManager()
