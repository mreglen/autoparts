"""Бизнес-логика: регистрация, продление, рефералы (ключ не меняется)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from config import Settings
from db import (
    MarzVpnUser,
    add_referral,
    create_user,
    extend_expire,
    get_user,
)
from marzban_api import MarzbanClient
from happ_crypto import (
    encode_happ_crypto_link,
    generate_valid_happ_link_async,
    is_real_happ_crypto_link,
)
from utils import build_marzban_username

logger = logging.getLogger("marzban-vpn-bot.services")


def _needs_https_refresh(subscription_url: str, crypt4_link: str) -> bool:
    sub = subscription_url or ""
    link = crypt4_link or ""
    if sub.startswith("http://") or "195.24.65.251:2086" in sub or "195.24.65.251:62050" in sub:
        return True
    # soft crypt4 (eyJ...) Happ отклоняет — нужен официальный crypto
    if link.startswith("happ://crypt4/eyJ") or not is_real_happ_crypto_link(link):
        return True
    # уже официальный crypt5 — ок, если https sub
    if link.startswith("happ://crypt") and "eyJ" not in link.split("/", 3)[-1][:3]:
        if sub.startswith("https://"):
            return False
    return not link.startswith("happ://crypt")


async def ensure_real_crypto_link(
    session: AsyncSession,
    user: MarzVpnUser,
    marzban: MarzbanClient | None = None,
) -> MarzVpnUser:
    """Перешифровывает устаревшие/http ссылки в валидный HTTPS Happ crypt."""
    if not _needs_https_refresh(user.subscription_url, user.crypt4_link):
        return user

    sub = user.subscription_url
    if marzban is not None:
        try:
            remote = await marzban.get_user(user.marzban_username)
            if remote:
                extracted = marzban.extract_subscription_url(remote)
                if extracted:
                    sub = extracted
        except Exception as exc:
            logger.warning("refresh sub from marzban failed: %s", exc)
            sub = marzban.public_subscription_url(sub) if marzban else sub
    else:
        # минимальный https rewrite без клиента
        sub = (
            sub.replace("://195.24.65.251:2086", "://svoygarage.ru")
            .replace("://195.24.65.251:62050", "://svoygarage.ru")
            .replace("http://svoygarage.ru", "https://svoygarage.ru")
        )

    new_link = await generate_valid_happ_link_async(sub)
    user.subscription_url = sub
    user.crypt4_link = new_link
    user.key_valid = True
    user.verify_note = "official_happ_crypto"
    await session.commit()
    logger.info("Обновлён HTTPS ключ tg=%s → %s…", user.telegram_id, new_link[:28])
    return user


async def ensure_registered(
    session: AsyncSession,
    marzban: MarzbanClient,
    settings: Settings,
    *,
    telegram_id: int,
    username: str | None,
    referrer_id: int | None,
) -> tuple[MarzVpnUser, bool, bool]:
    """
    Возвращает (user, created_now, referral_rewarded).
    Ключ (subscription_url / crypt4) создаётся только при первой регистрации.
    """
    existing = await get_user(session, telegram_id)
    if existing is not None:
        existing = await ensure_real_crypto_link(session, existing, marzban)
        return existing, False, False

    now = datetime.now(timezone.utc)
    expire_at = now + timedelta(minutes=settings.trial_minutes)
    marzban_username = build_marzban_username(telegram_id)

    # Нельзя пригласить самого себя; реферер должен уже существовать
    safe_referrer: int | None = None
    if referrer_id and referrer_id != telegram_id:
        if await get_user(session, referrer_id) is not None:
            safe_referrer = referrer_id

    payload = await marzban.create_user(
        marzban_username,
        expire_at=expire_at,
        note=f"tg:{telegram_id}",
    )
    sub_url = marzban.extract_subscription_url(payload)
    if not sub_url:
        raise RuntimeError(
            "Marzban не вернул subscription_url. "
            "Проверьте XRAY_SUBSCRIPTION_URL_PREFIX / Host Settings."
        )
    crypt4 = await generate_valid_happ_link_async(sub_url)

    user = await create_user(
        session,
        telegram_id=telegram_id,
        username=username,
        marzban_username=marzban_username,
        subscription_url=sub_url,
        crypt4_link=crypt4,
        expire_at=expire_at,
        referrer_id=safe_referrer,
    )

    rewarded = False
    if safe_referrer is not None:
        rewarded = await apply_referral_reward(
            session,
            marzban,
            settings,
            referrer_id=safe_referrer,
            referred_id=telegram_id,
        )

    await session.commit()
    logger.info(
        "Зарегистрирован tg=%s marzban=%s expire=%s ref=%s rewarded=%s",
        telegram_id,
        marzban_username,
        expire_at.isoformat(),
        safe_referrer,
        rewarded,
    )
    return user, True, rewarded


async def apply_referral_reward(
    session: AsyncSession,
    marzban: MarzbanClient,
    settings: Settings,
    *,
    referrer_id: int,
    referred_id: int,
) -> bool:
    """+N дней рефереру в БД и Marzban. Ключ не меняется."""
    row = await add_referral(
        session,
        referrer_id=referrer_id,
        referred_id=referred_id,
        reward_days=settings.referral_reward_days,
    )
    if row is None:
        return False

    new_expire = await extend_expire(
        session,
        referrer_id,
        settings.referral_reward_days,
    )
    if new_expire is None:
        return False

    referrer = await get_user(session, referrer_id)
    if referrer is None:
        return False

    await marzban.activate_user(referrer.marzban_username, expire_at=new_expire)
    logger.info(
        "Реферал: referrer=%s +%sд → expire=%s (referred=%s)",
        referrer_id,
        settings.referral_reward_days,
        new_expire.isoformat(),
        referred_id,
    )
    return True


async def sync_expire_to_marzban(
    marzban: MarzbanClient,
    user: MarzVpnUser,
) -> None:
    """Обновляет expire в Marzban без смены subscription URL."""
    now = datetime.now(timezone.utc)
    expire_at = user.expire_at
    if expire_at.tzinfo is None:
        expire_at = expire_at.replace(tzinfo=timezone.utc)

    if expire_at <= now:
        await marzban.disable_user(user.marzban_username)
    else:
        await marzban.activate_user(user.marzban_username, expire_at=expire_at)
