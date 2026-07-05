import re
from datetime import datetime, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy.orm import Session

from alert_bot.config import Settings
from alert_bot.db.models import AlertBotAuthSession, AlertBotSubscriber, User, utcnow

_ph = PasswordHasher()
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        _ph.verify(hashed_password, plain_password)
        return True
    except VerifyMismatchError:
        return False


def is_valid_email(value: str) -> bool:
    return bool(_EMAIL_RE.match(value.strip()))


def get_subscriber(db: Session, chat_id: int) -> AlertBotSubscriber | None:
    return (
        db.query(AlertBotSubscriber)
        .filter(AlertBotSubscriber.telegram_chat_id == chat_id, AlertBotSubscriber.is_active.is_(True))
        .first()
    )


def get_auth_session(db: Session, chat_id: int) -> AlertBotAuthSession:
    session = db.query(AlertBotAuthSession).filter(AlertBotAuthSession.telegram_chat_id == chat_id).first()
    if session is None:
        session = AlertBotAuthSession(telegram_chat_id=chat_id, state="awaiting_email")
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


def reset_auth_session(db: Session, chat_id: int) -> AlertBotAuthSession:
    session = get_auth_session(db, chat_id)
    session.state = "awaiting_email"
    session.email_temp = None
    session.failure_count = 0
    session.locked_until = None
    session.updated_at = utcnow()
    db.commit()
    return session


def is_locked(session: AlertBotAuthSession) -> bool:
    if session.locked_until is None:
        return False
    now = utcnow()
    locked = session.locked_until
    if locked.tzinfo is None:
        locked = locked.replace(tzinfo=timezone.utc)
    return now < locked


def register_failure(db: Session, session: AlertBotAuthSession, settings: Settings) -> bool:
    """Returns True if account is now locked."""
    session.failure_count += 1
    if session.failure_count >= settings.max_auth_failures:
        from datetime import timedelta

        session.locked_until = utcnow() + timedelta(seconds=settings.auth_lockout_sec)
        session.state = "locked"
        db.commit()
        return True
    db.commit()
    return False


def find_admin_by_email(db: Session, email: str) -> User | None:
    return (
        db.query(User)
        .filter(User.email.ilike(email.strip()), User.is_admin.is_(True))
        .first()
    )


def activate_subscriber(db: Session, chat_id: int, user_id: int) -> AlertBotSubscriber:
    sub = db.query(AlertBotSubscriber).filter(AlertBotSubscriber.telegram_chat_id == chat_id).first()
    if sub is None:
        sub = AlertBotSubscriber(telegram_chat_id=chat_id, user_id=user_id, is_active=True)
        db.add(sub)
    else:
        sub.user_id = user_id
        sub.is_active = True
    db.query(AlertBotAuthSession).filter(AlertBotAuthSession.telegram_chat_id == chat_id).delete()
    db.commit()
    db.refresh(sub)
    return sub


def deactivate_subscriber(db: Session, chat_id: int) -> None:
    sub = db.query(AlertBotSubscriber).filter(AlertBotSubscriber.telegram_chat_id == chat_id).first()
    if sub:
        sub.is_active = False
        db.commit()
