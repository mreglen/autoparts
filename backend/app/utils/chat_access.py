"""Shared chat access helpers for direct and group chats."""
from sqlalchemy import and_, or_
from sqlalchemy.orm import Query, Session

from app.models.chat import Chat, ChatParticipant
from app.services.organization_chat_service import CHAT_TYPE_DIRECT


def get_chat_type(chat: Chat) -> str:
    return getattr(chat, "chat_type", None) or CHAT_TYPE_DIRECT


def is_group_chat(chat: Chat) -> bool:
    return get_chat_type(chat) != CHAT_TYPE_DIRECT


def user_has_chat_access(chat: Chat, user_id: int, db: Session) -> bool:
    if not is_group_chat(chat):
        return chat.buyer_id == user_id or chat.seller_id == user_id
    return (
        db.query(ChatParticipant.id)
        .filter(
            ChatParticipant.chat_id == chat.id,
            ChatParticipant.user_id == user_id,
        )
        .first()
        is not None
    )


def get_accessible_chat(db: Session, chat_id: int, user_id: int) -> Chat | None:
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_active == True).first()
    if not chat or not user_has_chat_access(chat, user_id, db):
        return None
    return chat


def get_user_chats_query(db: Session, user_id: int) -> Query:
    participant_chat_ids = (
        db.query(ChatParticipant.chat_id)
        .filter(ChatParticipant.user_id == user_id)
        .scalar_subquery()
    )
    return db.query(Chat).filter(
        Chat.is_active == True,
        or_(
            Chat.id.in_(participant_chat_ids),
            and_(
                or_(Chat.chat_type == CHAT_TYPE_DIRECT, Chat.chat_type.is_(None)),
                or_(Chat.buyer_id == user_id, Chat.seller_id == user_id),
            ),
        ),
    )


def get_chat_participant_ids(db: Session, chat_id: int) -> list[int]:
    rows = (
        db.query(ChatParticipant.user_id)
        .filter(ChatParticipant.chat_id == chat_id)
        .all()
    )
    return [row[0] for row in rows]
