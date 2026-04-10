from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
import anyio
import os
import uuid
from pathlib import Path
from app.db.database import get_db
from app.models.chat import Chat, Message, ChatMedia, ChatBlockedUser
from app.models.user import User
from app.models.product import Product
from app.schemas.chat import (
    ChatCreate,
    ChatResponse,
    ChatListResponse,
    MessageCreate,
    MessageResponse,
    ChatMediaResponse,
    ChatBlockResponse
)
from app.core.auth import get_current_user
from app.routers.websocket import manager as websocket_manager

router = APIRouter(prefix="/api/chats", tags=["chats"])


@router.post("/", response_model=ChatResponse)
def create_or_get_chat(
    chat_data: ChatCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новый чат или получить существующий"""
    
    # Если передан product_id, автоматически определяем продавца
    seller_id = chat_data.seller_id
    if chat_data.product_id and not seller_id:
        product = db.query(Product).filter(Product.id == chat_data.product_id).first()
        if product:
            # Получаем первого пользователя организации (обычно это владелец/директор)
            seller = db.query(User).filter(
                User.organization_id == product.organization_id,
                (User.is_director == True) | (User.is_seller == True)
            ).first()
            
            if seller:
                seller_id = seller.id
            else:
                # Если нет директора/продавца, берем любого пользователя организации
                seller = db.query(User).filter(
                    User.organization_id == product.organization_id
                ).first()
                if seller:
                    seller_id = seller.id
    
    if not seller_id:
        raise HTTPException(status_code=400, detail="Не удалось определить продавца")
    
    # Проверяем, существует ли уже чат между этими пользователями для этого товара
    existing_chat = db.query(Chat).filter(
        Chat.buyer_id == chat_data.buyer_id,
        Chat.seller_id == seller_id,
        Chat.product_id == chat_data.product_id,
        Chat.is_active == True
    ).first()
    
    if existing_chat:
        # Возвращаем существующий чат
        return _build_chat_response(existing_chat, db, current_user)
    
    # Создаем новый чат
    new_chat = Chat(
        buyer_id=chat_data.buyer_id,
        seller_id=seller_id,
        product_id=chat_data.product_id
    )
    
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    
    return _build_chat_response(new_chat, db, current_user)


@router.get("/", response_model=ChatListResponse)
def get_user_chats(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить все чаты пользователя"""
    
    # Получаем чаты где пользователь - покупатель или продавец
    chats_query = db.query(Chat).filter(
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id)) &
        (Chat.is_active == True)
    ).order_by(desc(Chat.updated_at))
    
    total = chats_query.count()
    chats = chats_query.offset(skip).limit(limit).all()
    
    chat_responses = []
    for chat in chats:
        chat_responses.append(_build_chat_response(chat, db, current_user))
    
    return ChatListResponse(chats=chat_responses, total=total)


@router.get("/{chat_id}", response_model=ChatResponse)
def get_chat(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить информацию о чате"""
    
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    return _build_chat_response(chat, db, current_user)


@router.get("/{chat_id}/messages", response_model=List[MessageResponse])
def get_chat_messages(
    chat_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить сообщения чата"""
    
    # Проверяем доступ к чату
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    # Получаем сообщения
    messages = db.query(Message).filter(
        Message.chat_id == chat_id
    ).order_by(desc(Message.created_at)).offset(skip).limit(limit).all()
    
    # Отмечаем сообщения как прочитанные (если пользователь не отправитель)
    unread_messages = db.query(Message).filter(
        Message.chat_id == chat_id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).all()

    read_message_ids = []
    sender_ids_to_notify = set()
    for msg in unread_messages:
        msg.is_read = True
        read_message_ids.append(msg.id)
        sender_ids_to_notify.add(msg.sender_id)

    db.commit()

    # Уведомляем отправителей о прочтении сообщений через WebSocket (если они online)
    if read_message_ids:
        read_event = {
            "type": "messages_read",
            "chat_id": chat_id,
            "message_ids": read_message_ids,
            "read_by_user_id": current_user.id
        }
        for sender_id in sender_ids_to_notify:
            try:
                anyio.from_thread.run(websocket_manager.send_personal_message, read_event, sender_id)
            except Exception:
                # Не ломаем API-ответ, если realtime-уведомление не доставилось
                pass
    
    # Возвращаем сообщения в правильном порядке (от старых к новым)
    messages_reversed = list(reversed(messages))
    
    # Добавляем медиа к каждому сообщению
    # Фильтруем сообщения с is_processing медиа для пользователей, которые не являются отправителем
    result = []
    for msg in messages_reversed:
        media_list = db.query(ChatMedia).filter(
            ChatMedia.message_id == msg.id
        ).all()
        
        # Проверяем, есть ли медиа в процессе обработки
        has_processing_media = any(m.is_processing for m in media_list)
        
        # Если пользователь не отправитель и есть медиа в обработке, пропускаем сообщение
        if msg.sender_id != current_user.id and has_processing_media:
            continue
        
        result.append(MessageResponse(
            id=msg.id,
            chat_id=msg.chat_id,
            sender_id=msg.sender_id,
            message=msg.message,
            is_read=msg.is_read,
            created_at=msg.created_at,
            media=[
                ChatMediaResponse(
                    id=m.id,
                    message_id=m.message_id,
                    media_type=m.media_type,
                    file_path=m.file_path,
                    thumbnail_path=m.thumbnail_path,
                    original_filename=m.original_filename,
                    file_size=m.file_size,
                    mime_type=m.mime_type,
                    width=m.width,
                    height=m.height,
                    duration=m.duration,
                    is_processing=m.is_processing if m.is_processing is not None else False,
                    created_at=m.created_at
                ) for m in media_list
            ]
        ))
    
    return result


@router.post("/{chat_id}/messages", response_model=MessageResponse)
def send_message(
    chat_id: int,
    message_data: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Отправить сообщение в чат"""
    
    # Проверяем доступ к чату
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    # Проверяем, что отправитель не заблокирован
    blocked = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat_id,
        ChatBlockedUser.blocked_user_id == current_user.id
    ).first()
    
    if blocked:
        raise HTTPException(
            status_code=403, 
            detail="Вы заблокированы в этом чате и не можете отправлять сообщения"
        )
    
    # Проверяем, что отправитель является участником чата
    if current_user.id != message_data.sender_id:
        raise HTTPException(status_code=403, detail="Вы не можете отправлять сообщения от имени другого пользователя")
    
    # Создаем сообщение
    new_message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message=message_data.message,
        reply_to_id=message_data.reply_to_id
    )
    
    db.add(new_message)
    
    # Обновляем время обновления чата
    db.query(Chat).filter(Chat.id == chat_id).update({"updated_at": func.now()})
    
    db.commit()
    db.refresh(new_message)

    # Push realtime-сообщение второму участнику чата
    recipient_id = chat.seller_id if current_user.id == chat.buyer_id else chat.buyer_id
    ws_payload = {
        "type": "message",
        "id": new_message.id,
        "chat_id": new_message.chat_id,
        "sender_id": new_message.sender_id,
        "message": new_message.message,
        "is_read": new_message.is_read,
        "reply_to_id": new_message.reply_to_id,
        "created_at": new_message.created_at.isoformat(),
        "media": []
    }
    try:
        anyio.from_thread.run(websocket_manager.send_personal_message, ws_payload, recipient_id)
    except Exception:
        pass
    
    # Получаем информацию об ответе, если есть
    reply_to = None
    if new_message.reply_to_id:
        reply_to = db.query(Message).filter(Message.id == new_message.reply_to_id).first()
        # Преобразуем в простой dict для response
        if reply_to:
            reply_to = {
                "id": reply_to.id,
                "message": reply_to.message,
                "sender_id": reply_to.sender_id,
                "created_at": reply_to.created_at
            }
    
    return MessageResponse(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        message=new_message.message,
        is_read=new_message.is_read,
        reply_to_id=new_message.reply_to_id,
        reply_to=reply_to,
        created_at=new_message.created_at,
        media=[]  # Обычные сообщения без медиа
    )


@router.get("/unread/count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить количество непрочитанных сообщений"""
    
    count = db.query(Message).join(Chat).filter(
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id)),
        Message.sender_id != current_user.id,
        Message.is_read == False,
        Chat.is_active == True
    ).count()
    
    return {"unread_count": count}


@router.post("/{chat_id}/messages/upload-media", response_model=MessageResponse)
async def upload_chat_media(
    chat_id: int,
    files: List[UploadFile] = File(...),
    message: Optional[str] = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Загрузить медиа файлы (изображения/видео) в чат"""
    
    # Проверяем доступ к чату
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    # Проверяем, что отправитель не заблокирован
    blocked = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat_id,
        ChatBlockedUser.blocked_user_id == current_user.id
    ).first()
    
    if blocked:
        raise HTTPException(
            status_code=403, 
            detail="Вы заблокированы в этом чате и не можете отправлять сообщения"
        )
    
    # Проверяем количество файлов (макс 5)
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Максимум 5 файлов за раз")
    
    # Создаем сообщение
    new_message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        message=message
    )
    db.add(new_message)
    db.flush()  # Получаем ID сообщения
    
    # Создаем директорию для медиа
    upload_dir = Path("uploads/chat_media/original")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    # Поддерживаемые типы файлов
    allowed_image_types = {'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'}
    allowed_video_types = {'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'}
    allowed_document_types = {
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed'
    }
    max_image_size = 10 * 1024 * 1024  # 10MB
    max_video_size = 50 * 1024 * 1024  # 50MB
    max_document_size = 20 * 1024 * 1024  # 20MB
    
    media_records = []
    
    for file in files:
        # Валидация типа файла
        if (file.content_type not in allowed_image_types and 
            file.content_type not in allowed_video_types and 
            file.content_type not in allowed_document_types):
            raise HTTPException(
                status_code=400,
                detail=f"Неподдерживаемый тип файла: {file.content_type}. Поддерживаются: изображения, видео, PDF, Word, Excel, PowerPoint, архивы"
            )
        
        # Читаем файл для проверки размера
        content = await file.read()
        file_size = len(content)
        
        # Проверка размера
        if file.content_type in allowed_image_types and file_size > max_image_size:
            raise HTTPException(status_code=400, detail="Изображение слишком большое (макс 10MB)")
        
        if file.content_type in allowed_video_types and file_size > max_video_size:
            raise HTTPException(status_code=400, detail="Видео слишком большое (макс 50MB)")
        
        if file.content_type in allowed_document_types and file_size > max_document_size:
            raise HTTPException(status_code=400, detail="Файл слишком большой (макс 20MB)")
        
        # Определяем тип медиа
        if file.content_type in allowed_image_types:
            media_type = 'image'
        elif file.content_type in allowed_video_types:
            media_type = 'video'
        else:
            media_type = 'document'
        
        # Генерируем уникальное имя файла
        file_ext = Path(file.filename).suffix if file.filename else '.jpg'
        unique_filename = f"{uuid.uuid4().hex}{file_ext}"
        file_path = upload_dir / unique_filename
        
        # Сохраняем файл
        with open(file_path, 'wb') as f:
            f.write(content)
        
        # Создаем запись в БД
        media_record = ChatMedia(
            message_id=new_message.id,
            media_type=media_type,
            file_path=str(file_path),
            original_filename=file.filename,
            file_size=file_size,
            mime_type=file.content_type,
            is_processing=True
        )
        db.add(media_record)
        media_records.append(media_record)
    
    # Обновляем время чата
    db.query(Chat).filter(Chat.id == chat_id).update({"updated_at": func.now()})
    db.commit()
    
    # Запускаем Celery задачи для сжатия (только для изображений и видео)
    from app.tasks.chat_media_tasks import compress_chat_image, compress_chat_video, log_error
    
    for media in media_records:
        try:
            if media.media_type == 'image':
                print(f"📤 Отправка задачи на сжатие изображения: media_id={media.id}")
                result = compress_chat_image.apply_async(args=[media.id], link_error=log_error.s())
                print(f"✅ Задача отправлена: task_id={result.id}")
            elif media.media_type == 'video':
                print(f"📤 Отправка задачи на сжатие видео: media_id={media.id}")
                result = compress_chat_video.apply_async(args=[media.id], link_error=log_error.s())
                print(f"✅ Задача отправлена: task_id={result.id}")
            else:
                # Для документов сразу отмечаем как обработанные
                media.is_processing = False
                print(f"📄 Документ не требует обработки: media_id={media.id}")
        except Exception as e:
            # Если Celery недоступен, отмечаем как обработанное чтобы не зависало
            print(f"⚠️ Ошибка отправки задачи Celery: {e}")
            media.is_processing = False
    
    # Коммитим изменения
    db.commit()
    
    # Возвращаем сообщение с медиа
    db.refresh(new_message)

    # Push realtime-сообщение второму участнику чата
    recipient_id = chat.seller_id if current_user.id == chat.buyer_id else chat.buyer_id
    ws_payload = {
        "type": "message",
        "id": new_message.id,
        "chat_id": new_message.chat_id,
        "sender_id": new_message.sender_id,
        "message": new_message.message,
        "is_read": new_message.is_read,
        "created_at": new_message.created_at.isoformat(),
        "media": [
            {
                "id": m.id,
                "message_id": m.message_id,
                "media_type": m.media_type,
                "file_path": m.file_path,
                "thumbnail_path": m.thumbnail_path,
                "original_filename": m.original_filename,
                "file_size": m.file_size,
                "mime_type": m.mime_type,
                "width": m.width,
                "height": m.height,
                "duration": m.duration,
                "is_processing": m.is_processing if m.is_processing is not None else False,
                "created_at": m.created_at.isoformat()
            }
            for m in media_records
        ]
    }
    try:
        await websocket_manager.send_personal_message(ws_payload, recipient_id)
    except Exception:
        pass
    
    return MessageResponse(
        id=new_message.id,
        chat_id=new_message.chat_id,
        sender_id=new_message.sender_id,
        message=new_message.message,
        is_read=new_message.is_read,
        created_at=new_message.created_at,
        media=[
            ChatMediaResponse(
                id=m.id,
                message_id=m.message_id,
                media_type=m.media_type,
                file_path=m.file_path,
                thumbnail_path=m.thumbnail_path,
                original_filename=m.original_filename,
                file_size=m.file_size,
                mime_type=m.mime_type,
                width=m.width,
                height=m.height,
                duration=m.duration,
                is_processing=m.is_processing if m.is_processing is not None else False,
                created_at=m.created_at
            ) for m in media_records
        ]
    )


@router.get("/media/{media_id}")
def get_chat_media(
    media_id: int,
    request: Request,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Получить медиа файл"""
    from fastapi.responses import FileResponse
    from app.core.auth import get_current_user, oauth2_scheme
    from jose import jwt
    from app.core.config import Settings
    
    settings = Settings()
    
    # Пробуем получить токен из query parameter или из header
    auth_token = token
    if not auth_token:
        # Пробуем получить из Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ", 1)[1]
    
    if not auth_token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    
    # Декодируем токен
    try:
        payload = jwt.decode(auth_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Недействительный токен")
    except Exception:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    
    # Получаем пользователя
    from app.utils.phone import normalize_to_storage_format
    current_user = db.query(User).filter(User.email == email).first()
    if not current_user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    
    media = db.query(ChatMedia).filter(ChatMedia.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Медиа не найдено")
    
    # Проверяем доступ к чату
    message = db.query(Message).filter(Message.id == media.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    
    chat = db.query(Chat).filter(
        Chat.id == message.chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=403, detail="Нет доступа к этому медиа")
    
    # Проверяем существует ли файл
    if not os.path.exists(media.file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    # Для документов добавляем заголовок для скачивания
    # Для изображений и видео - inline (просмотр в браузере)
    if media.media_type == 'document':
        return FileResponse(
            path=media.file_path,
            media_type=media.mime_type,
            filename=media.original_filename,
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{media.original_filename}"}
        )
    else:
        return FileResponse(
            path=media.file_path,
            media_type=media.mime_type,
            filename=media.original_filename
        )


@router.get("/media/{media_id}/thumbnail")
def get_chat_media_thumbnail(
    media_id: int,
    request: Request,
    token: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Получить thumbnail медиа файла"""
    from fastapi.responses import FileResponse
    from jose import jwt
    from app.core.config import Settings
    
    settings = Settings()
    
    # Пробуем получить токен из query parameter или из header
    auth_token = token
    if not auth_token:
        # Пробуем получить из Authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            auth_token = auth_header.split(" ", 1)[1]
    
    if not auth_token:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    
    # Декодируем токен
    try:
        payload = jwt.decode(auth_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Недействительный токен")
    except Exception:
        raise HTTPException(status_code=401, detail="Недействительный токен")
    
    # Получаем пользователя
    current_user = db.query(User).filter(User.email == email).first()
    if not current_user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    
    media = db.query(ChatMedia).filter(ChatMedia.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Медиа не найдено")
    
    # Проверяем доступ к чату
    message = db.query(Message).filter(Message.id == media.message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Сообщение не найдено")
    
    chat = db.query(Chat).filter(
        Chat.id == message.chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=403, detail="Нет доступа к этому медиа")
    
    # Если thumbnail нет, возвращаем основной файл (для изображений)
    file_path = media.thumbnail_path if media.thumbnail_path else media.file_path
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Файл не найден")
    
    return FileResponse(
        path=file_path,
        media_type='image/jpeg',
        filename=f"thumbnail_{media_id}.jpg"
    )


@router.post("/{chat_id}/block/{user_id}", response_model=ChatBlockResponse)
def block_user_in_chat(
    chat_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Block a user in the chat"""
    # Check access to chat
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    # Cannot block yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать себя")
    
    # Check that user_id is a chat participant
    if user_id not in [chat.buyer_id, chat.seller_id]:
        raise HTTPException(status_code=400, detail="Пользователь не является участником чата")
    
    # Check if already blocked
    existing = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat_id,
        ChatBlockedUser.blocked_user_id == user_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь уже заблокирован")
    
    # Create block
    block = ChatBlockedUser(
        chat_id=chat_id,
        blocked_by_id=current_user.id,
        blocked_user_id=user_id
    )
    
    db.add(block)
    db.commit()
    db.refresh(block)
    
    return ChatBlockResponse(
        chat_id=block.chat_id,
        blocked_user_id=block.blocked_user_id,
        blocked_by_id=block.blocked_by_id,
        is_blocked=True,
        created_at=block.created_at
    )


@router.delete("/{chat_id}/block/{user_id}")
def unblock_user_in_chat(
    chat_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Unblock a user in the chat"""
    # Find the block
    block = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat_id,
        ChatBlockedUser.blocked_user_id == user_id,
        ChatBlockedUser.blocked_by_id == current_user.id
    ).first()
    
    if not block:
        raise HTTPException(status_code=404, detail="Блокировка не найдена")
    
    db.delete(block)
    db.commit()
    
    return {"message": "Пользователь разблокирован", "is_blocked": False}


@router.get("/{chat_id}/block-status")
def get_block_status(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get block status in the chat"""
    # Check access to chat
    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        ((Chat.buyer_id == current_user.id) | (Chat.seller_id == current_user.id))
    ).first()
    
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    # Check if current user is blocked
    is_blocked = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat_id,
        ChatBlockedUser.blocked_user_id == current_user.id
    ).first()
    
    # Get all blocked users
    blocked_users = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat_id
    ).all()
    
    return {
        "is_blocked": is_blocked is not None,
        "blocked_by_id": is_blocked.blocked_by_id if is_blocked else None,
        "blocked_users": [
            {
                "user_id": b.blocked_user_id,
                "blocked_by_id": b.blocked_by_id,
                "created_at": b.created_at
            }
            for b in blocked_users
        ]
    }


def _build_chat_response(chat: Chat, db: Session, current_user: User = None) -> ChatResponse:
    """Создать ответ чата с дополнительной информацией"""
    
    # Получаем последнее сообщение
    last_message = db.query(Message).filter(
        Message.chat_id == chat.id
    ).order_by(desc(Message.created_at)).first()
    
    # Получаем количество непрочитанных сообщений для текущего пользователя
    unread_count = 0
    if current_user:
        unread_count = db.query(Message).filter(
            Message.chat_id == chat.id,
            Message.sender_id != current_user.id,
            Message.is_read == False
        ).count()
    
    # Получаем информацию о продавце
    seller = db.query(User).filter(User.id == chat.seller_id).first()
    seller_name = seller.first_name if seller else None
    seller_phone = seller.phone if seller else None
    seller_organization = None
    
    if seller and seller.organization_id:
        from app.models.organization import Organization
        org = db.query(Organization).filter(Organization.id == seller.organization_id).first()
        seller_organization = org.name if org else None
    
    # Получаем информацию о покупателе
    buyer = db.query(User).filter(User.id == chat.buyer_id).first()
    buyer_name = buyer.first_name if buyer else None
    buyer_phone = buyer.phone if buyer else None
    
    # Получаем информацию о товаре
    product_name = None
    product_article = None
    product_price = None
    product_photo_url = None
    product_url = None
    
    if chat.product_id:
        product = db.query(Product).filter(Product.id == chat.product_id).first()
        if product:
            product_name = product.name
            product_article = product.article
            product_price = float(product.price) if product.price else None
            product_url = f"/part/{product.id}"
            
            # Получаем первое фото товара
            from app.models.product import ProductPhoto
            first_photo = db.query(ProductPhoto).filter(
                ProductPhoto.product_id == product.id
            ).order_by(ProductPhoto.id).first()
            
            if first_photo:
                # Используем full_url property для получения полного URL
                product_photo_url = first_photo.full_url
    
    # Проверяем статус блокировки
    is_blocked = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat.id,
        ChatBlockedUser.blocked_user_id == current_user.id
    ).first() is not None
    
    blocked_count = db.query(ChatBlockedUser).filter(
        ChatBlockedUser.chat_id == chat.id
    ).count()
    
    return ChatResponse(
        id=chat.id,
        buyer_id=chat.buyer_id,
        seller_id=chat.seller_id,
        product_id=chat.product_id,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        is_active=chat.is_active,
        last_message=MessageResponse(
            id=last_message.id,
            chat_id=last_message.chat_id,
            sender_id=last_message.sender_id,
            message=last_message.message,
            is_read=last_message.is_read,
            created_at=last_message.created_at
        ) if last_message else None,
        unread_count=unread_count,
        seller_name=seller_name,
        seller_phone=seller_phone,
        seller_organization=seller_organization,
        buyer_name=buyer_name,
        buyer_phone=buyer_phone,
        product_name=product_name,
        product_article=product_article,
        product_price=product_price,
        product_photo_url=product_photo_url,
        product_url=product_url,
        current_user_id=current_user.id if current_user else None,
        is_current_user_blocked=is_blocked,
        blocked_users_count=blocked_count
    )
