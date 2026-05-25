"""Create and sync organization group chats."""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models.chat import Chat, ChatParticipant
from app.models.organization import Organization
from app.models.user import User

logger = logging.getLogger(__name__)

CHAT_TYPE_DIRECT = "direct"
CHAT_TYPE_ORGANIZATION = "organization"
CHAT_TYPE_DIRECTORS = "directors"

DIRECTORS_CHAT_TITLE = "Директора организаций"


def _org_chat_title(org: Organization) -> str:
    return f"{org.name} — Общий чат"


def ensure_organization_chat(db: Session, org_id: str) -> Optional[Chat]:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        return None

    chat = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_ORGANIZATION,
            Chat.organization_id == org_id,
            Chat.is_active == True,
        )
        .first()
    )
    if chat:
        if chat.title != _org_chat_title(org):
            chat.title = _org_chat_title(org)
        return chat

    chat = Chat(
        chat_type=CHAT_TYPE_ORGANIZATION,
        organization_id=org_id,
        title=_org_chat_title(org),
        buyer_id=None,
        seller_id=None,
        is_active=True,
    )
    db.add(chat)
    db.flush()
    logger.info("Created organization chat for org %s (chat_id=%s)", org_id, chat.id)
    return chat


def ensure_directors_chat(db: Session) -> Chat:
    chat = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_DIRECTORS,
            Chat.is_active == True,
        )
        .first()
    )
    if chat:
        if chat.title != DIRECTORS_CHAT_TITLE:
            chat.title = DIRECTORS_CHAT_TITLE
        return chat

    chat = Chat(
        chat_type=CHAT_TYPE_DIRECTORS,
        title=DIRECTORS_CHAT_TITLE,
        buyer_id=None,
        seller_id=None,
        is_active=True,
    )
    db.add(chat)
    db.flush()
    logger.info("Created global directors chat (chat_id=%s)", chat.id)
    return chat


def _add_participant(db: Session, chat_id: int, user_id: int) -> None:
    exists = (
        db.query(ChatParticipant)
        .filter(
            ChatParticipant.chat_id == chat_id,
            ChatParticipant.user_id == user_id,
        )
        .first()
    )
    if not exists:
        db.add(ChatParticipant(chat_id=chat_id, user_id=user_id))


def _remove_participant(db: Session, chat_id: int, user_id: int) -> None:
    db.query(ChatParticipant).filter(
        ChatParticipant.chat_id == chat_id,
        ChatParticipant.user_id == user_id,
    ).delete(synchronize_session=False)


def sync_organization_chat_members(db: Session, org_id: str) -> None:
    chat = ensure_organization_chat(db, org_id)
    if not chat:
        return

    org_users = db.query(User).filter(User.organization_id == org_id).all()
    member_ids = {u.id for u in org_users}

    existing = (
        db.query(ChatParticipant)
        .filter(ChatParticipant.chat_id == chat.id)
        .all()
    )
    existing_ids = {p.user_id for p in existing}

    for user_id in member_ids - existing_ids:
        _add_participant(db, chat.id, user_id)

    for user_id in existing_ids - member_ids:
        _remove_participant(db, chat.id, user_id)


def sync_directors_chat_members(db: Session) -> None:
    chat = ensure_directors_chat(db)

    directors = (
        db.query(User)
        .filter(
            User.is_director == True,
            User.organization_id.isnot(None),
        )
        .all()
    )
    director_ids = {u.id for u in directors}

    existing = (
        db.query(ChatParticipant)
        .filter(ChatParticipant.chat_id == chat.id)
        .all()
    )
    existing_ids = {p.user_id for p in existing}

    for user_id in director_ids - existing_ids:
        _add_participant(db, chat.id, user_id)

    for user_id in existing_ids - director_ids:
        _remove_participant(db, chat.id, user_id)


def on_user_joined_organization(db: Session, user: User) -> None:
    if not user.organization_id:
        return

    ensure_organization_chat(db, user.organization_id)
    org_chat = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_ORGANIZATION,
            Chat.organization_id == user.organization_id,
            Chat.is_active == True,
        )
        .first()
    )
    if org_chat:
        _add_participant(db, org_chat.id, user.id)

    if user.is_director:
        directors_chat = ensure_directors_chat(db)
        _add_participant(db, directors_chat.id, user.id)


def on_user_left_organization(db: Session, user_id: int, org_id: str) -> None:
    org_chat = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_ORGANIZATION,
            Chat.organization_id == org_id,
            Chat.is_active == True,
        )
        .first()
    )
    if org_chat:
        _remove_participant(db, org_chat.id, user_id)

    directors_chat = (
        db.query(Chat)
        .filter(
            Chat.chat_type == CHAT_TYPE_DIRECTORS,
            Chat.is_active == True,
        )
        .first()
    )
    if directors_chat:
        _remove_participant(db, directors_chat.id, user_id)


def backfill_all_organization_chats(db: Session) -> None:
    orgs = db.query(Organization).all()
    for org in orgs:
        ensure_organization_chat(db, org.id)
        sync_organization_chat_members(db, org.id)

    ensure_directors_chat(db)
    sync_directors_chat_members(db)
    db.commit()
    logger.info("Backfilled organization chats for %s organizations", len(orgs))
