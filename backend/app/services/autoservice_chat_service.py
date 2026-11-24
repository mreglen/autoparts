"""Бизнес-логика чатов клиент↔автосервис (chat_type='autoservice')."""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.chat import Chat
from app.models.user import User
from app.services.organization_chat_service import (
    CHAT_TYPE_AUTOSERVICE,
    _add_participant,
    _remove_participant,
)
from app.utils.autoservice_access import AUTOSERVICE_PERMISSION_CHAT, has_autoservice_permission


def is_autoservice_chat_type(chat: Chat) -> bool:
    return (getattr(chat, "chat_type", None) or "direct") == CHAT_TYPE_AUTOSERVICE


def can_manage_autoservice_chat(db: Session, chat: Chat, user: User) -> bool:
    """Управлять участниками может обладатель права autoservice.chat своей орг."""
    if not is_autoservice_chat_type(chat):
        return False
    if not user.organization_id or user.organization_id != chat.organization_id:
        return False
    return has_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_CHAT)


def _user_display_name(user: User) -> str:
    parts = [user.last_name, user.first_name, user.patronymic]
    name = " ".join(p for p in parts if p).strip()
    return name or user.email or user.phone or f"ID {user.id}"


def add_autoservice_chat_participant(
    db: Session,
    chat: Chat,
    actor: User,
    target_user_id: int,
) -> None:
    if not can_manage_autoservice_chat(db, chat, actor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    if target.organization_id != chat.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Можно добавлять только сотрудников своей организации",
        )
    if chat.buyer_id and int(target.id) == int(chat.buyer_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Клиент уже участник чата")
    _add_participant(db, chat.id, target.id)
    db.commit()


def remove_autoservice_chat_participant(
    db: Session,
    chat: Chat,
    actor: User,
    target_user_id: int,
) -> None:
    if not can_manage_autoservice_chat(db, chat, actor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав")
    if chat.buyer_id and int(target_user_id) == int(chat.buyer_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя удалить клиента из чата")
    if int(target_user_id) == int(actor.id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя удалить себя из чата")
    _remove_participant(db, chat.id, target_user_id)
    db.commit()


def search_autoservice_chat_staff(
    db: Session,
    chat: Chat,
    *,
    query: str = "",
    limit: int = 30,
) -> list[dict]:
    """Сотрудники орг автосервиса для добавления в чат."""
    limit = min(max(limit, 1), 50)
    q = (query or "").strip().lower()
    base = db.query(User).filter(User.organization_id == chat.organization_id)
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
    return [
        {
            "user_id": u.id,
            "public_code": u.public_code,
            "display_name": _user_display_name(u),
            "avatar_url": u.avatar_url,
            "organization_id": u.organization_id,
            "is_seller": bool(u.is_seller),
            "is_buyer": False,
        }
        for u in rows
    ]
