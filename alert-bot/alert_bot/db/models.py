from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    """Read-only mirror of backend users table for auth."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, index=True)
    hashed_password = Column(String)
    is_admin = Column(Boolean, default=False)


class AlertBotSubscriber(Base):
    __tablename__ = "alert_bot_subscribers"

    id = Column(Integer, primary_key=True)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subscribed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    user = relationship("User")


class AlertBotAuthSession(Base):
    __tablename__ = "alert_bot_auth_sessions"

    telegram_chat_id = Column(BigInteger, primary_key=True)
    state = Column(String(32), nullable=False, default="awaiting_email")
    email_temp = Column(String(255), nullable=True)
    failure_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ServerErrorEvent(Base):
    __tablename__ = "server_error_events"

    id = Column(Integer, primary_key=True)
    source = Column(String(64), nullable=False, index=True)
    severity = Column(String(16), nullable=False, default="warning")
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    meta = Column(JSONB, nullable=True)
    dedupe_key = Column(String(128), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    __table_args__ = (
        Index("ix_server_error_events_dedupe_created", "dedupe_key", "created_at"),
    )


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
