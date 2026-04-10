from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict
import json
from app.db.database import get_db
from app.models.chat import Chat, Message
from app.models.user import User
from datetime import datetime

router = APIRouter()

# Хранилище активных подключений: user_id -> WebSocket
active_connections: Dict[int, WebSocket] = {}


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_json(message)

    async def broadcast_to_chat(self, message: dict, chat_id: int, db: Session, exclude_user_id: int = None):
        """Отправить сообщение всем участникам чата + push notification если offline"""
        from app.routers.notifications import send_push_notification
        from app.models.chat import Chat
        from app.models.user import User
        
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if chat:
            # Получаем информацию об отправителе
            sender = db.query(User).filter(User.id == message.get("sender_id")).first()
            sender_name = sender.name if sender else "Неизвестный"
            
            # Отправляем покупателю (если это не отправитель)
            if chat.buyer_id != exclude_user_id:
                if chat.buyer_id in self.active_connections:
                    await self.send_personal_message(message, chat.buyer_id)
                else:
                    # User not connected via WebSocket - send push notification
                    push_data = {
                        "type": "message",
                        "title": f"Новое сообщение от {sender_name}",
                        "body": message.get("message", "")[:100],  # Truncate to 100 chars
                        "chatId": chat_id,
                        "senderId": message.get("sender_id"),
                        "senderName": sender_name,
                        "url": f"/chats/{chat_id}"
                    }
                    send_push_notification(chat.buyer_id, push_data, db)
            
            # Отправляем продавцу (если это не отправитель)
            if chat.seller_id != exclude_user_id:
                if chat.seller_id in self.active_connections:
                    await self.send_personal_message(message, chat.seller_id)
                else:
                    # User not connected via WebSocket - send push notification
                    push_data = {
                        "type": "message",
                        "title": f"Новое сообщение от {sender_name}",
                        "body": message.get("message", "")[:100],  # Truncate to 100 chars
                        "chatId": chat_id,
                        "senderId": message.get("sender_id"),
                        "senderName": sender_name,
                        "url": f"/chats/{chat_id}"
                    }
                    send_push_notification(chat.seller_id, push_data, db)


manager = ConnectionManager()


@router.websocket("/ws/chat/{user_id}")
async def chat_websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint для чатов"""
    
    print(f"[WS] Connection attempt for user_id={user_id}")
    print(f"[WS] Client: {websocket.client}")
    
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
                
                # Сохраняем сообщение в БД
                db_gen = get_db()
                db = next(db_gen)
                
                try:
                    # Проверяем доступ к чату
                    chat = db.query(Chat).filter(
                        Chat.id == chat_id,
                        ((Chat.buyer_id == user_id) | (Chat.seller_id == user_id))
                    ).first()
                    
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
                    
                    # Отправляем всем участникам чата (кроме отправителя)
                    await manager.broadcast_to_chat(message_response, chat_id, db, exclude_user_id=int(user_id))
                    
                except Exception as e:
                    print(f"Error processing message: {e}")
                    db.rollback()
                finally:
                    db.close()
            
            elif message_data.get("type") == "typing":
                # Отправляем индикатор набора текста
                chat_id = message_data.get("chat_id")
                if chat_id:
                    typing_message = {
                        "type": "typing",
                        "user_id": user_id,
                        "chat_id": chat_id
                    }
                    await manager.broadcast_to_chat(typing_message, chat_id, None)
                    
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(user_id)
