"""Утилиты: Happ crypt4, HTML, время подписки."""

from __future__ import annotations

import base64
import json
import secrets
from datetime import datetime, timezone


def encode_happ_crypt4(subscription_url: str) -> str:
    """Кодирует обычную ссылку подписки в формат happ://crypt4/..."""
    payload = {"url": subscription_url}
    json_bytes = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )
    return f"happ://crypt4/{base64.b64encode(json_bytes).decode('utf-8')}"


def decode_happ_crypt4(crypt4_link: str) -> str | None:
    """Достаёт subscription URL из happ://crypt4/... или None при ошибке."""
    prefix = "happ://crypt4/"
    if not crypt4_link.startswith(prefix):
        return None
    try:
        raw = base64.b64decode(crypt4_link[len(prefix) :].encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
        url = data.get("url")
        return url if isinstance(url, str) and url.strip() else None
    except Exception:
        return None


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
