from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, Set
import json
from app.db.database import get_db
from app.models.chat import Chat, Message, ChatParticipant
from app.models.user import User
from datetime import datetime
from jose import jwt
from app.core.config import Settings
from app.utils.chat_access import get_accessible_chat, is_group_chat, get_chat_participant_ids

router = APIRouter()
settings = Settings()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id not in self.active_connections:
            return
        self.active_connections[user_id].discard(websocket)
        if not self.active_connections[user_id]:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        user_sockets = self.active_connections.get(user_id)
        if not user_sockets:
            return

        stale_connections = []
        for socket in list(user_sockets):
            try:
                await socket.send_json(message)
            except Exception:
                stale_connections.append(socket)

        for socket in stale_connections:
            self.disconnect(user_id, socket)

    async def broadcast_to_organization(
        self,
        organization_id: str,
        ws_payload: dict,
        db: Session,
        *,
        push_title: str,
        push_body: str,
    ) -> None:
        """Всем пользователям организации: WebSocket; если офлайн — Web Push."""
        from app.routers.notifications import send_push_notification

        users = db.query(User).filter(User.organization_id == organization_id).all()
        chat_q = ws_payload.get("avito_chat_id")
        url_suffix = f"/chats?tab=avito&avitoChatId={chat_q}" if chat_q else "/chats?tab=avito"
        for u in users:
            uid = u.id
            if self.active_connections.get(uid):
                await self.send_personal_message(ws_payload, uid)
            else:
                send_push_notification(
                    uid,
                    {
                        "type": "avito_messenger",
                        "title": push_title,
                        "body": (push_body or "Новое сообщение")[:120],
                        "url": url_suffix,
                    },
                    db,
                )

    async def broadcast_to_chat(self, message: dict, chat_id: int, db: Session, exclude_user_id: int = None):
        """Отправить сообщение всем участникам чата + push notification если offline"""
        from app.routers.notifications import send_push_notification
        from app.models.user import User
        
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            return

        sender = db.query(User).filter(User.id == message.get("sender_id")).first()
        sender_name = (
            sender.first_name
            or sender.phone
            or sender.email
        ) if sender else "Неизвестный"

        if is_group_chat(chat):
            recipient_ids = get_chat_participant_ids(db, chat_id)
        else:
            recipient_ids = [uid for uid in (chat.buyer_id, chat.seller_id) if uid]

        chat_title = chat.title or "Чат"
        push_url = f"/chats?source={'organization' if is_group_chat(chat) else 'garage'}&chatId={chat_id}"

        for recipient_id in recipient_ids:
            if recipient_id == exclude_user_id:
                continue
            if self.active_connections.get(recipient_id):
                await self.send_personal_message(message, recipient_id)
            else:
                push_data = {
                    "type": "message",
                    "title": f"{sender_name} — {chat_title}" if is_group_chat(chat) else f"Новое сообщение от {sender_name}",
                    "body": message.get("message", "")[:100],
                    "chatId": chat_id,
                    "senderId": message.get("sender_id"),
                    "senderName": sender_name,
                    "url": push_url,
                }
                send_push_notification(recipient_id, push_data, db)


manager = ConnectionManager()


@router.websocket("/ws/chat/{user_id}")
async def chat_websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint для чатов"""
    
    print(f"[WS] Connection attempt for user_id={user_id}")
    print(f"[WS] Client: {websocket.client}")
    
    # Проверяем токен авторизации и соответствие user_id
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008, reason="Missing auth token")
        return

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if not email:
            await websocket.close(code=1008, reason="Invalid token payload")
            return
    except Exception:
        await websocket.close(code=1008, reason="Invalid auth token")
        return

    db_gen = get_db()
    db = next(db_gen)
    try:
        ws_user = db.query(User).filter(User.email == email).first()
        if not ws_user or ws_user.id != int(user_id):
            await websocket.close(code=1008, reason="Token user mismatch")
            return
    finally:
        db.close()

    try:
        await manager.connect(websocket, user_id)
        print(f"[WS] Successfully connected user_id={user_id}")
    except Exception as e:
        print(f"[WS] Error accepting connection for user_id={user_id}: {e}")
        return
    
    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Обрабатываем сообщение
            if message_data.get("type") == "message":
                chat_id = message_data.get("chat_id")
                message_text = message_data.get("message")
                sender_id = message_data.get("sender_id")
                reply_to_id = message_data.get("reply_to_id")
                
                if not all([chat_id, message_text, sender_id]):
                    continue
                if int(sender_id) != int(user_id):
                    continue
                
                # Сохраняем сообщение в БД
                db_gen = get_db()
                db = next(db_gen)
                
                try:
                    chat = get_accessible_chat(db, chat_id, user_id)
                    
                    if not chat:
                        continue
                    
                    # Создаем сообщение
                    new_message = Message(
                        chat_id=chat_id,
                        sender_id=sender_id,
                        message=message_text,
                        is_read=False,
                        reply_to_id=reply_to_id
                    )
                    
                    db.add(new_message)
                    
                    # Обновляем время чата
                    from sqlalchemy import func
                    db.query(Chat).filter(Chat.id == chat_id).update({"updated_at": func.now()})
                    db.commit()
                    db.refresh(new_message)
                    
                    # Получаем информацию об ответе
                    reply_to = None
                    if new_message.reply_to_id:
                        reply_to_msg = db.query(Message).filter(Message.id == new_message.reply_to_id).first()
                        if reply_to_msg:
                            reply_to = {
                                "id": reply_to_msg.id,
                                "message": reply_to_msg.message,
                                "sender_id": reply_to_msg.sender_id,
                                "created_at": reply_to_msg.created_at.isoformat()
                            }
                    
                    # Формируем ответ
                    message_response = {
                        "type": "message",
                        "id": new_message.id,
                        "chat_id": new_message.chat_id,
                        "sender_id": new_message.sender_id,
                        "message": new_message.message,
                        "is_read": new_message.is_read,
                        "reply_to_id": new_message.reply_to_id,
                        "reply_to": reply_to,
                        "created_at": new_message.created_at.isoformat()
                    }
                    
                    # Отправляем всем участникам чата, включая отправителя.
                    # Это нужно, чтобы на клиенте временное сообщение (temp_*) заменялось
                    # на реальное сообщение с id из БД без ожидания ручного refresh.
                    await manager.broadcast_to_chat(message_response, chat_id, db, exclude_user_id=None)
                    
                except Exception as e:
                    print(f"Error processing message: {e}")
                    db.rollback()
                finally:
                    db.close()
            
            elif message_data.get("type") == "typing":
                # Отправляем индикатор набора текста
                chat_id = message_data.get("chat_id")
                if chat_id:
                    db_gen = get_db()
                    db = next(db_gen)
                    try:
                        chat = db.query(Chat).filter(Chat.id == chat_id).first()
                        if chat:
                            typing_message = {
                                "type": "typing",
                                "user_id": user_id,
                                "chat_id": chat_id
                            }
                            if is_group_chat(chat):
                                for recipient_id in get_chat_participant_ids(db, chat_id):
                                    if recipient_id != user_id:
                                        await manager.send_personal_message(typing_message, recipient_id)
                            elif chat.buyer_id and chat.seller_id:
                                recipient_id = chat.seller_id if int(user_id) == chat.buyer_id else chat.buyer_id
                                await manager.send_personal_message(typing_message, recipient_id)
                    finally:
                        db.close()
            
            elif message_data.get("type") == "ping":
                # Respond to ping to keep connection alive
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat()
                })
                    
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(user_id, websocket)
