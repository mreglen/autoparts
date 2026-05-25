from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..db.database import Base


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    chat_type = Column(String(20), nullable=False, default="direct", server_default="direct")
    buyer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    organization_id = Column(String(10), ForeignKey("organizations.id"), nullable=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)

    # Relationships
    buyer = relationship("User", foreign_keys=[buyer_id])
    seller = relationship("User", foreign_keys=[seller_id])
    product = relationship("Product")
    organization = relationship("Organization")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    participants = relationship("ChatParticipant", back_populates="chat", cascade="all, delete-orphan")


class ChatParticipant(Base):
    __tablename__ = "chat_participants"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    chat = relationship("Chat", back_populates="participants")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("chat_id", "user_id", name="uq_chat_participant"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    reply_to = relationship("Message", remote_side=[id], backref="replies", foreign_keys=[reply_to_id])
    media = relationship("ChatMedia", back_populates="message", cascade="all, delete-orphan")


class ChatMedia(Base):
    __tablename__ = "chat_media"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    media_type = Column(String(20), nullable=False)  # 'image', 'video', 'document'
    file_path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    original_filename = Column(String(255), nullable=True)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # в основном для видео
    is_processing = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    message = relationship("Message", back_populates="media")


class ChatBlockedUser(Base):
    """Model for tracking blocked users in specific chats"""
    __tablename__ = "chat_blocked_users"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    blocked_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Who blocked
    blocked_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Who was blocked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    chat = relationship("Chat", foreign_keys=[chat_id])
    blocked_by = relationship("User", foreign_keys=[blocked_by_id])
    blocked_user = relationship("User", foreign_keys=[blocked_user_id])
    
    # Unique constraint: one user can be blocked only once per chat
    __table_args__ = (
        UniqueConstraint('chat_id', 'blocked_user_id', name='uq_chat_blocked_user'),
    )
