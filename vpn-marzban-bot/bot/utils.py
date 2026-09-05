"""Утилиты: HTML, время подписки, username Marzban."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

# Реэкспорт генератора валидных Happ-ссылок
from happ_crypto import (  # noqa: F401
    encode_happ_crypt4,
    encode_happ_crypto_link,
    generate_valid_happ_link,
    generate_valid_happ_link_async,
    get_single_happ_link,
)


def build_marzban_username(telegram_user_id: int) -> str:
    """Уникальный username для Marzban: 3–32 символа, a-z0-9_."""
    suffix = secrets.token_hex(3)
    return f"tg_{telegram_user_id}_{suffix}"[:32]


def html_escape(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def html_code(value: str) -> str:
    return f"<code>{html_escape(value)}</code>"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def format_remaining(expire_at: datetime, now: datetime | None = None) -> str:
    """Формат: «N дней H часов M минут» (неотрицательный)."""
    now = now or utcnow()
    if expire_at.tzinfo is None:
        expire_at = expire_at.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    delta = expire_at - now
    total_seconds = max(0, int(delta.total_seconds()))
    days, rem = divmod(total_seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, _ = divmod(rem, 60)
    return f"{days} дней {hours} часов {minutes} минут"


def parse_referral_payload(text: str | None) -> int | None:
    """Из `/start ref_12345` или `ref_12345` возвращает telegram_id реферера."""
    if not text:
        return None
    parts = text.strip().split(maxsplit=1)
    payload = parts[1] if len(parts) > 1 else parts[0]
    payload = payload.strip()
    if not payload.startswith("ref_"):
        return None
    raw = payload[4:].strip()
    if not raw.isdigit():
        return None
    return int(raw)
