from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Dict, Set, Optional
import asyncio
import json
import logging
from app.db.database import get_db
from app.models.chat import Chat, Message, ChatParticipant
from app.models.user import User
from datetime import datetime
from jose import jwt
from app.core.config import Settings
from app.utils.chat_access import get_accessible_chat, is_group_chat, get_chat_participant_ids

logger = logging.getLogger(__name__)

router = APIRouter()
settings = Settings()
MAX_WS_CONNECTIONS_PER_USER = settings.WEBSOCKET_MAX_CONNECTIONS_PER_USER
WS_PUSH_CHANNEL = "ws:push"
WS_ONLINE_KEY_PREFIX = "ws:online_count:"
WS_ONLINE_TTL_SECONDS = 300


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self._pubsub_task: Optional[asyncio.Task] = None
        self._pubsub_started = False

    def connection_count(self, user_id: int) -> int:
        return len(self.active_connections.get(user_id, set()))

    async def connect(self, websocket: WebSocket, user_id: int) -> bool:
        current = self.connection_count(user_id)
        if current >= MAX_WS_CONNECTIONS_PER_USER:
            return False
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        await self._incr_user_online(user_id)
        return True

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id not in self.active_connections:
            return
        self.active_connections[user_id].discard(websocket)
        if not self.active_connections[user_id]:
            del self.active_connections[user_id]
        asyncio.create_task(self._decr_user_online(user_id))

    async def _incr_user_online(self, user_id: int) -> None:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        try:
            key = f"{WS_ONLINE_KEY_PREFIX}{user_id}"
            await redis.incr(key)
            await redis.expire(key, WS_ONLINE_TTL_SECONDS)
        finally:
            await redis.aclose()

    async def _decr_user_online(self, user_id: int) -> None:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        try:
            key = f"{WS_ONLINE_KEY_PREFIX}{user_id}"
            count = await redis.decr(key)
            if count <= 0:
                await redis.delete(key)
            else:
                await redis.expire(key, WS_ONLINE_TTL_SECONDS)
        finally:
            await redis.aclose()

    async def is_user_online_globally(self, user_id: int) -> bool:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        try:
            key = f"{WS_ONLINE_KEY_PREFIX}{user_id}"
            count = await redis.get(key)
            return bool(count and int(count) > 0)
        finally:
            await redis.aclose()

    async def start_pubsub_bridge(self) -> None:
        if self._pubsub_started:
            return
        self._pubsub_started = True
        self._pubsub_task = asyncio.create_task(self._pubsub_listener())
        logger.info("WebSocket Redis pub/sub bridge started (pid channel=%s)", WS_PUSH_CHANNEL)

    async def stop_pubsub_bridge(self) -> None:
        if self._pubsub_task:
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass
            self._pubsub_task = None
        self._pubsub_started = False

    async def _pubsub_listener(self) -> None:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(WS_PUSH_CHANNEL)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    data = json.loads(message["data"])
                    user_id = data.get("user_id")
                    payload = data.get("payload")
                    if user_id is not None and payload is not None:
                        await self._deliver_local(int(user_id), payload)
                except Exception as exc:
                    logger.warning("WebSocket pub/sub message handling failed: %s", exc)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("WebSocket pub/sub listener stopped: %s", exc)
        finally:
            try:
                await pubsub.unsubscribe(WS_PUSH_CHANNEL)
                await pubsub.aclose()
                await redis.aclose()
            except Exception:
                pass

    async def _deliver_local(self, user_id: int, message: dict) -> None:
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

    async def _publish_push(self, user_id: int, message: dict) -> None:
        from redis.asyncio import Redis

        redis = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        try:
            await redis.publish(
                WS_PUSH_CHANNEL,
                json.dumps({"user_id": user_id, "payload": message}, ensure_ascii=False),
            )
        finally:
            await redis.aclose()

    async def send_personal_message(self, message: dict, user_id: int):
        try:
            await self._publish_push(user_id, message)
        except Exception as exc:
            logger.warning("WebSocket publish failed, local fallback: %s", exc)
            await self._deliver_local(user_id, message)

    async def broadcast_to_organization(
        self,
        organization_id: str,
        ws_payload: dict,
        db: Session,
        *,
        push_title: str,
        push_body: str,
    ) -> None:
        """Всем пользователям организации: WebSocket; если офлайн — push/email."""
        from app.services.notification_service import (
            EVENT_AVITO_MESSENGER,
            dispatch_user_notification,
        )

        users = db.query(User).filter(User.organization_id == organization_id).all()
        chat_q = ws_payload.get("avito_chat_id")
        url_suffix = f"/chats?tab=avito&avitoChatId={chat_q}" if chat_q else "/chats?tab=avito"
        body_preview = (push_body or "Новое сообщение")[:120]
        for u in users:
            uid = u.id
            if await self.is_user_online_globally(uid):
                await self.send_personal_message(ws_payload, uid)
            else:
                push_data = {
                    "type": "avito_messenger",
                    "title": push_title,
                    "body": body_preview,
                    "url": url_suffix,
                }
                email_body = (
                    f"{push_title}\n\n{body_preview}\n\n"
                    f"Откройте чат: https://svoygarage.ru{url_suffix}\n\n"
                    f"С уважением,\nСвой Гараж"
                )
                dispatch_user_notification(
                    uid,
                    event_type=EVENT_AVITO_MESSENGER,
                    push_data=push_data,
                    email_subject=push_title,
                    email_body=email_body,
                )

    async def broadcast_to_chat(self, message: dict, chat_id: int, db: Session, exclude_user_id: int = None):
        """Отправить сообщение всем участникам чата + push/email если offline"""
        from app.models.user import User
        from app.services.notification_service import EVENT_CHAT_MESSAGE, dispatch_user_notification
        
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
            if await self.is_user_online_globally(recipient_id):
                await self.send_personal_message(message, recipient_id)
            else:
                push_title = (
                    f"{sender_name} — {chat_title}"
                    if is_group_chat(chat)
                    else f"Новое сообщение от {sender_name}"
                )
                message_preview = (message.get("message") or "")[:100]
                push_data = {
                    "type": "message",
                    "title": push_title,
                    "body": message_preview,
                    "chatId": chat_id,
                    "senderId": message.get("sender_id"),
                    "senderName": sender_name,
                    "url": push_url,
                }
                email_body = (
                    f"{push_title}\n\n{message_preview}\n\n"
                    f"Ответьте в чате: https://svoygarage.ru{push_url}\n\n"
                    f"С уважением,\nСвой Гараж"
                )
                dispatch_user_notification(
                    recipient_id,
                    event_type=EVENT_CHAT_MESSAGE,
                    push_data=push_data,
                    email_subject=push_title,
                    email_body=email_body,
                )


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
        connected = await manager.connect(websocket, user_id)
        if not connected:
            await websocket.close(code=1008, reason="Too many connections")
            return
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
