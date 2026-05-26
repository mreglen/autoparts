"""Пользовательские групповые чаты организации (не автоматический «Общий чат»)."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.chat import Chat, ChatParticipant
from app.models.user import User
from app.services.organization_chat_service import (
    CHAT_TYPE_CUSTOM,
    CHAT_TYPE_ORGANIZATION,
    CHAT_TYPE_SELLERS,
    _add_participant,
    _remove_participant,
)

logger = logging.getLogger(__name__)

SYSTEM_GROUP_TYPES = frozenset({CHAT_TYPE_ORGANIZATION, CHAT_TYPE_SELLERS, "directors"})


def _user_display_name(user: User) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(p for p in parts if p and str(p).strip()).strip()
    return name or user.phone or user.email or f"ID {user.id}"


def can_create_custom_chat(user: User) -> bool:
    return bool(user.is_admin or (user.is_director and user.organization_id))


def can_manage_custom_chat(chat: Chat, user: User) -> bool:
    if get_chat_type_value(chat) != CHAT_TYPE_CUSTOM:
        return False
    if user.is_admin:
        return True
    if user.is_director and chat.organization_id and chat.organization_id == user.organization_id:
        return True
    created_by = getattr(chat, "created_by_id", None)
    return created_by is not None and created_by == user.id


def can_delete_chat(chat: Chat, user: User) -> bool:
    if get_chat_type_value(chat) in SYSTEM_GROUP_TYPES:
        return False
    if get_chat_type_value(chat) != CHAT_TYPE_CUSTOM:
        return False
    return can_manage_custom_chat(chat, user)


def get_chat_type_value(chat: Chat) -> str:
    return getattr(chat, "chat_type", None) or "direct"


def _resolve_org_id_for_create(user: User, organization_id: Optional[str]) -> Optional[str]:
    if user.is_admin:
        return (organization_id or "").strip() or None
    if user.is_director and user.organization_id:
        if organization_id and organization_id != user.organization_id:
            raise HTTPException(status_code=403, detail="Можно создавать чаты только своей организации")
        return user.organization_id
    raise HTTPException(status_code=403, detail="Недостаточно прав для создания чата")


def _validate_participant_for_chat(
    db: Session,
    chat: Chat,
    actor: User,
    target: User,
) -> None:
    if target.id == actor.id:
        return
    if actor.is_admin:
        return
    if actor.is_director and chat.organization_id:
        if target.organization_id != chat.organization_id:
            raise HTTPException(
                status_code=403,
                detail="Директор может добавлять только сотрудников своей организации",
            )
        return
    raise HTTPException(status_code=403, detail="Недостаточно прав")


def create_custom_chat(
    db: Session,
    *,
    actor: User,
    title: str,
    participant_ids: list[int],
    organization_id: Optional[str] = None,
) -> Chat:
    if not can_create_custom_chat(actor):
        raise HTTPException(status_code=403, detail="Недостаточно прав для создания чата")

    clean_title = (title or "").strip()
    if not clean_title or len(clean_title) > 255:
        raise HTTPException(status_code=400, detail="Укажите название чата (до 255 символов)")

    org_id = _resolve_org_id_for_create(actor, organization_id)

    chat = Chat(
        chat_type=CHAT_TYPE_CUSTOM,
        organization_id=org_id,
        title=clean_title,
        buyer_id=None,
        seller_id=None,
        is_active=True,
        created_by_id=actor.id,
    )
    db.add(chat)
    db.flush()

    _add_participant(db, chat.id, actor.id)
    member_ids = {int(uid) for uid in participant_ids if uid}
    member_ids.discard(actor.id)

    for uid in member_ids:
        target = db.query(User).filter(User.id == uid).first()
        if not target:
            continue
        _validate_participant_for_chat(db, chat, actor, target)
        _add_participant(db, chat.id, target.id)

    db.commit()
    db.refresh(chat)
    logger.info("Custom chat created id=%s by user=%s", chat.id, actor.id)
    return chat


def delete_custom_chat(db: Session, chat: Chat, actor: User) -> None:
    if not can_delete_chat(chat, actor):
        raise HTTPException(status_code=403, detail="Этот чат нельзя удалить")
    chat.is_active = False
    db.query(ChatParticipant).filter(ChatParticipant.chat_id == chat.id).delete(
        synchronize_session=False
    )
    db.commit()


def add_participant_to_custom_chat(
    db: Session,
    chat: Chat,
    actor: User,
    target_user_id: int,
) -> None:
    if not can_manage_custom_chat(chat, actor):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    _validate_participant_for_chat(db, chat, actor, target)
    _add_participant(db, chat.id, target.id)
    db.commit()


def remove_participant_from_custom_chat(
    db: Session,
    chat: Chat,
    actor: User,
    target_user_id: int,
) -> None:
    if not can_manage_custom_chat(chat, actor):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    created_by = getattr(chat, "created_by_id", None)
    if created_by and target_user_id == created_by:
        raise HTTPException(status_code=400, detail="Нельзя удалить создателя чата из участников")
    _remove_participant(db, chat.id, target_user_id)
    db.commit()


def search_manageable_users(
    db: Session,
    actor: User,
    *,
    query: str = "",
    chat: Optional[Chat] = None,
    limit: int = 30,
) -> list[dict]:
    q = (query or "").strip().lower()
    limit = min(max(limit, 1), 50)

    base = db.query(User)
    if chat and get_chat_type_value(chat) == CHAT_TYPE_CUSTOM:
        if actor.is_admin:
            pass
        elif actor.is_director and chat.organization_id:
            base = base.filter(User.organization_id == chat.organization_id)
        else:
            return []
    elif actor.is_admin:
        pass
    elif actor.is_director and actor.organization_id:
        base = base.filter(User.organization_id == actor.organization_id)
    else:
        return []

    if q:
        like = f"%{q}%"
        base = base.filter(
            or_(
                User.first_name.ilike(like),
                User.last_name.ilike(like),
                User.email.ilike(like),
                User.phone.ilike(like),
                User.public_code.ilike(like),
            )
        )

    rows = base.order_by(User.last_name.asc(), User.first_name.asc()).limit(limit).all()
    result = []
    for u in rows:
        result.append(
            {
                "user_id": u.id,
                "public_code": u.public_code,
                "display_name": _user_display_name(u),
                "avatar_url": u.avatar_url,
                "organization_id": u.organization_id,
                "is_seller": bool(u.is_seller),
                "is_buyer": bool(u.is_buyer),
            }
        )
    return result
