"""Async SQLAlchemy модели и репозиторий (префикс таблиц marzvpn_)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    select,
    update,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from config import Settings


class Base(DeclarativeBase):
    pass


class MarzVpnUser(Base):
    __tablename__ = "marzvpn_users"

    telegram_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    marzban_username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    subscription_url: Mapped[str] = mapped_column(Text, nullable=False)
    crypt4_link: Mapped[str] = mapped_column(Text, nullable=False)
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    referrer_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    # Служебные поля для Celery-проверки подлинности ключа
    key_valid: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verify_note: Mapped[str | None] = mapped_column(Text, nullable=True)


class MarzVpnReferral(Base):
    __tablename__ = "marzvpn_referrals"
    __table_args__ = (
        UniqueConstraint("referrer_id", "referred_id", name="uq_marzvpn_referral_pair"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    referrer_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("marzvpn_users.telegram_id"),
        nullable=False,
    )
    referred_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("marzvpn_users.telegram_id"),
        nullable=False,
    )
    reward_days: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db(settings: Settings) -> None:
    global _engine, _session_factory
    _engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    _session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def create_tables() -> None:
    if _engine is None:
        raise RuntimeError("DB не инициализирована: вызовите init_db()")
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def session_factory() -> async_sessionmaker[AsyncSession]:
    if _session_factory is None:
        raise RuntimeError("DB не инициализирована: вызовите init_db()")
    return _session_factory


async def get_user(session: AsyncSession, telegram_id: int) -> MarzVpnUser | None:
    return await session.get(MarzVpnUser, telegram_id)


async def create_user(
    session: AsyncSession,
    *,
    telegram_id: int,
    username: str | None,
    marzban_username: str,
    subscription_url: str,
    crypt4_link: str,
    expire_at: datetime,
    referrer_id: int | None,
) -> MarzVpnUser:
    user = MarzVpnUser(
        telegram_id=telegram_id,
        username=username,
        marzban_username=marzban_username,
        subscription_url=subscription_url,
        crypt4_link=crypt4_link,
        expire_at=expire_at,
        referrer_id=referrer_id,
        key_valid=True,
    )
    session.add(user)
    await session.flush()
    return user


async def extend_expire(
    session: AsyncSession,
    telegram_id: int,
    days: int,
    *,
    from_now_if_expired: bool = True,
) -> datetime | None:
    """Продлевает expire_at. Если подписка уже истекла — от now + days."""
    user = await get_user(session, telegram_id)
    if user is None:
        return None

    now = datetime.now(timezone.utc)
    base = user.expire_at
    if base.tzinfo is None:
        base = base.replace(tzinfo=timezone.utc)

    if from_now_if_expired and base < now:
        base = now

    user.expire_at = base + timedelta(days=days)
    await session.flush()
    return user.expire_at


async def add_referral(
    session: AsyncSession,
    *,
    referrer_id: int,
    referred_id: int,
    reward_days: int,
) -> MarzVpnReferral | None:
    """Создаёт запись реферала. None если пара уже существует или self-ref."""
    if referrer_id == referred_id:
        return None

    existing = await session.scalar(
        select(MarzVpnReferral).where(
            MarzVpnReferral.referrer_id == referrer_id,
            MarzVpnReferral.referred_id == referred_id,
        )
    )
    if existing is not None:
        return None

    referrer = await get_user(session, referrer_id)
    if referrer is None:
        return None

    row = MarzVpnReferral(
        referrer_id=referrer_id,
        referred_id=referred_id,
        reward_days=reward_days,
    )
    session.add(row)
    await session.flush()
    return row


async def list_all_users(session: AsyncSession) -> Sequence[MarzVpnUser]:
    result = await session.scalars(select(MarzVpnUser).order_by(MarzVpnUser.telegram_id))
    return result.all()


async def list_expired_active_candidates(
    session: AsyncSession,
) -> Sequence[MarzVpnUser]:
    now = datetime.now(timezone.utc)
    result = await session.scalars(
        select(MarzVpnUser).where(MarzVpnUser.expire_at < now)
    )
    return result.all()


async def mark_user_verified(
    session: AsyncSession,
    telegram_id: int,
    *,
    key_valid: bool,
    note: str | None,
) -> None:
    await session.execute(
        update(MarzVpnUser)
        .where(MarzVpnUser.telegram_id == telegram_id)
        .values(
            key_valid=key_valid,
            last_verified_at=datetime.now(timezone.utc),
            verify_note=note,
        )
    )
