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
        """Отправить сообщение всем участникам чата, кроме отправителя"""
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if chat:
            # Отправляем покупателю (если это не отправитель)
            if chat.buyer_id != exclude_user_id and chat.buyer_id in self.active_connections:
                await self.send_personal_message(message, chat.buyer_id)
            # Отправляем продавцу (если это не отправитель)
            if chat.seller_id != exclude_user_id and chat.seller_id in self.active_connections:
                await self.send_personal_message(message, chat.seller_id)


manager = ConnectionManager()


@router.websocket("/ws/chat/{user_id}")
async def chat_websocket_endpoint(websocket: WebSocket, user_id: int):
    """WebSocket endpoint для чатов"""
    
    await manager.connect(websocket, user_id)
    
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
                        is_read=False
                    )
                    
                    db.add(new_message)
                    
                    # Обновляем время чата
                    from sqlalchemy import func
                    db.query(Chat).filter(Chat.id == chat_id).update({"updated_at": func.now()})
                    db.commit()
                    db.refresh(new_message)
                    
                    # Формируем ответ
                    message_response = {
                        "type": "message",
                        "id": new_message.id,
                        "chat_id": new_message.chat_id,
                        "sender_id": new_message.sender_id,
                        "message": new_message.message,
                        "is_read": new_message.is_read,
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
