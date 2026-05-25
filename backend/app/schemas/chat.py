from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MessageBase(BaseModel):
    message: str


class ChatMediaResponse(BaseModel):
    id: int
    message_id: int
    media_type: str  # image | video | document
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


class ChatBlockResponse(BaseModel):
    """Response when blocking a user"""
    chat_id: int
    blocked_user_id: int
    blocked_by_id: int
    is_blocked: bool
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class MessageCreate(MessageBase):
    chat_id: int
    sender_id: int
    reply_to_id: Optional[int] = None


class MessageCreateWithMedia(BaseModel):
    """Создание сообщения с медиа файлами"""
    chat_id: int
    sender_id: int
    message: Optional[str] = ""
    reply_to_id: Optional[int] = None


class MessageResponse(MessageBase):
    id: int
    chat_id: int
    sender_id: int
    is_read: bool
    reply_to_id: Optional[int] = None
    created_at: datetime
    media: List[ChatMediaResponse] = []
    sender_name: Optional[str] = None
    
    # Replied message info (nested)
    reply_to: Optional['MessageResponse'] = None

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
    chat_type: str = "direct"
    buyer_id: Optional[int] = None
    seller_id: Optional[int] = None
    product_id: Optional[int] = None
    organization_id: Optional[str] = None
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_active: bool
    is_group: bool = False
    participants_count: int = 0
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0
    
    # Block status
    is_current_user_blocked: Optional[bool] = False  # Is current user blocked
    blocked_users_count: Optional[int] = 0  # How many users are blocked
    
    # Информация о продавце
    seller_name: Optional[str] = None
    seller_phone: Optional[str] = None
    seller_organization: Optional[str] = None
    seller_avatar_url: Optional[str] = None
    
    organization_name: Optional[str] = None
    organization_logo: Optional[str] = None
    
    # Информация о покупателе
    buyer_name: Optional[str] = None
    buyer_phone: Optional[str] = None
    buyer_avatar_url: Optional[str] = None
    
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
