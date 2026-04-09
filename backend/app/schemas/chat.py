from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MessageBase(BaseModel):
    message: str


class ChatMediaResponse(BaseModel):
    id: int
    message_id: int
    media_type: str  # 'image' или 'video'
    file_path: str
    thumbnail_path: Optional[str] = None
    original_filename: Optional[str] = None
    file_size: int
    mime_type: str
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    is_processing: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(MessageBase):
    chat_id: int
    sender_id: int


class MessageCreateWithMedia(BaseModel):
    """Создание сообщения с медиа файлами"""
    chat_id: int
    sender_id: int
    message: Optional[str] = ""


class MessageResponse(MessageBase):
    id: int
    chat_id: int
    sender_id: int
    is_read: bool
    created_at: datetime
    media: List[ChatMediaResponse] = []

    class Config:
        from_attributes = True


class ChatBase(BaseModel):
    buyer_id: int
    seller_id: Optional[int] = None  # Может быть None, backend определит автоматически
    product_id: Optional[int] = None


class ChatCreate(ChatBase):
    pass


class ChatResponse(BaseModel):
    id: int
    buyer_id: int
    seller_id: int
    product_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    
    # Информация о продавце
    seller_name: Optional[str] = None
    seller_phone: Optional[str] = None
    seller_organization: Optional[str] = None
    
    # Информация о покупателе
    buyer_name: Optional[str] = None
    buyer_phone: Optional[str] = None
    
    # Информация о товаре (если есть)
    product_name: Optional[str] = None
    product_article: Optional[str] = None
    product_price: Optional[float] = None
    product_photo_url: Optional[str] = None  # URL первого фото товара
    product_url: Optional[str] = None  # URL для перехода к объявлению
    
    # ID текущего пользователя (для определения роли)
    current_user_id: Optional[int] = None

    class Config:
        from_attributes = True


class ChatListResponse(BaseModel):
    chats: List[ChatResponse]
    total: int
