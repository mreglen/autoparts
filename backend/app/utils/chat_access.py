"""Shared chat access helpers for direct and group chats."""
from sqlalchemy import and_, or_
from sqlalchemy.orm import Query, Session

from app.models.chat import Chat, ChatParticipant
from app.models.user import User
from app.services.organization_chat_service import (
    CHAT_TYPE_AUTOSERVICE,
    CHAT_TYPE_DIRECT,
)


def get_chat_type(chat: Chat) -> str:
    return getattr(chat, "chat_type", None) or CHAT_TYPE_DIRECT


def is_group_chat(chat: Chat) -> bool:
    return get_chat_type(chat) != CHAT_TYPE_DIRECT


def is_autoservice_chat(chat: Chat) -> bool:
    return get_chat_type(chat) == CHAT_TYPE_AUTOSERVICE


def _user_is_autoservice_chat_client(chat: Chat, user_id: int) -> bool:
    return chat.buyer_id is not None and int(chat.buyer_id) == int(user_id)


def _user_is_chat_participant(db: Session, chat_id: int, user_id: int) -> bool:
    return (
        db.query(ChatParticipant.id)
        .filter(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == user_id,
        )
        .first()
        is not None
    )


def _staff_has_autoservice_chat_permission(db: Session, user: User, org_id: str | None) -> bool:
    """Сотрудник автосервиса с правом «Сообщения клиентов» для данной организации."""
    if not org_id or not user.organization_id or user.organization_id != org_id:
        return False
    from app.utils.autoservice_access import (
        AUTOSERVICE_PERMISSION_CHAT,
        has_autoservice_permission,
    )

    return has_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_CHAT)


def user_has_chat_access(chat: Chat, user_id: int, db: Session) -> bool:
    if not is_group_chat(chat):
        return chat.buyer_id == user_id or chat.seller_id == user_id
    if is_autoservice_chat(chat):
        if _user_is_autoservice_chat_client(chat, user_id):
            return True
        if _user_is_chat_participant(db, chat.id, user_id):
            return True
        user = db.query(User).filter(User.id == user_id).first()
        if user and _staff_has_autoservice_chat_permission(db, user, chat.organization_id):
            return True
        return False
    return _user_is_chat_participant(db, chat.id, user_id)


def get_accessible_chat(db: Session, chat_id: int, user_id: int) -> Chat | None:
    chat = db.query(Chat).filter(Chat.id == chat_id, Chat.is_active == True).first()
    if not chat or not user_has_chat_access(chat, user_id, db):
        return None
    return chat


def _autoservice_org_ids_with_chat_permission(db: Session, user_id: int) -> list[str]:
    """Орг-ids автосервисов, где у пользователя есть право autoservice.chat."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.organization_id:
        return []
    if not _staff_has_autoservice_chat_permission(db, user, user.organization_id):
        return []
    return [user.organization_id]


def get_user_chats_query(db: Session, user_id: int) -> Query:
    participant_chat_ids = (
        db.query(ChatParticipant.chat_id)
        .filter(ChatParticipant.user_id == user_id)
        .scalar_subquery()
    )
    conditions = [
        Chat.id.in_(participant_chat_ids),
        and_(
            or_(Chat.chat_type == CHAT_TYPE_DIRECT, Chat.chat_type.is_(None)),
            or_(Chat.buyer_id == user_id, Chat.seller_id == user_id),
        ),
    ]
    autoservice_org_ids = _autoservice_org_ids_with_chat_permission(db, user_id)
    if autoservice_org_ids:
        conditions.append(
            and_(
                Chat.chat_type == CHAT_TYPE_AUTOSERVICE,
                Chat.organization_id.in_(autoservice_org_ids),
                Chat.is_active == True,
            )
        )
    return db.query(Chat).filter(
        Chat.is_active == True,
        or_(*conditions),
    )


def get_chat_participant_ids(db: Session, chat_id: int) -> list[int]:
    rows = (
        db.query(ChatParticipant.user_id)
        .filter(ChatParticipant.chat_id == chat_id)
        .all()
    )
    return [row[0] for row in rows]


def get_autoservice_chat_staff_recipient_ids(db: Session, chat: Chat) -> list[int]:
    """Сотрудники орг автосервиса с правом autoservice.chat (для уведомлений)."""
    if not chat.organization_id:
        return []
    from app.models.permission import Permission
    from app.models.user_permission import UserPermission
    from app.utils.autoservice_access import AUTOSERVICE_PERMISSION_CHAT

    perm_user_ids = {
        row[0]
        for row in db.query(UserPermission.user_id)
        .join(Permission, Permission.id == UserPermission.permission_id)
        .filter(Permission.code == AUTOSERVICE_PERMISSION_CHAT)
        .all()
    }
    staff = (
        db.query(User)
        .filter(User.organization_id == chat.organization_id)
        .all()
    )
    from app.utils.autoservice_access import has_autoservice_permission

    result = []
    for u in staff:
        if u.id in perm_user_ids or u.is_admin or u.is_director or u.is_seller:
            if has_autoservice_permission(db, u, AUTOSERVICE_PERMISSION_CHAT):
                result.append(u.id)
    return result


def get_autoservice_chat_recipient_ids(db: Session, chat: Chat) -> list[int]:
    """Все получатели autoservice-чата: участники + staff с правом + клиент."""
    ids = set(get_chat_participant_ids(db, chat.id))
    ids.update(get_autoservice_chat_staff_recipient_ids(db, chat))
    if chat.buyer_id:
        ids.add(int(chat.buyer_id))
    return sorted(ids)
