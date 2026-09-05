"""Генерация ссылок Happ VPN: happ://crypt4/<base64(JSON{"url":...})>."""

from __future__ import annotations

import base64
import json
import logging

logger = logging.getLogger("marzban-vpn-bot.happ")


def generate_valid_happ_link(sub_url: str) -> str:
    """
    Генерирует ссылку для Happ VPN формата happ://crypt4/...

    1. Очищает URL подписки
    2. Упаковывает в JSON {"url": "..."}
    3. Кодирует JSON в Base64 (без переносов)
    4. Собирает happ://crypt4/<BASE64>
    """
    clean_url = (sub_url or "").strip()
    if not clean_url:
        raise ValueError("sub_url пустой")

    payload = {"url": clean_url}
    json_str = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    base64_str = base64.b64encode(json_str.encode("utf-8")).decode("ascii")
    link = f"happ://crypt4/{base64_str}"
    logger.info("generate_valid_happ_link crypt4 → %s…", link[:40])
    return link


async def generate_valid_happ_link_async(sub_url: str) -> str:
    """Async-обёртка (тот же алгоритм, без сети)."""
    return generate_valid_happ_link(sub_url)


def is_real_happ_crypto_link(link: str) -> bool:
    """Проверяет, что это happ://crypt4/ с декодируемым {"url": "..."}."""
    if not isinstance(link, str) or not link.startswith("happ://crypt4/"):
        return False
    try:
        raw = base64.b64decode(link[len("happ://crypt4/") :].encode("ascii"), validate=False)
        data = json.loads(raw.decode("utf-8"))
        url = data.get("url")
        return isinstance(url, str) and bool(url.strip())
    except Exception:
        return False


def decode_happ_crypt4(link: str) -> str | None:
    if not is_real_happ_crypto_link(link):
        return None
    raw = base64.b64decode(link[len("happ://crypt4/") :].encode("ascii"))
    data = json.loads(raw.decode("utf-8"))
    return str(data["url"]).strip()


# Алиасы для остального кода бота
def encode_happ_crypt4(subscription_url: str) -> str:
    return generate_valid_happ_link(subscription_url)


def encode_happ_crypto_link_sync(subscription_url: str) -> str:
    return generate_valid_happ_link(subscription_url)


async def encode_happ_crypto_link(subscription_url: str) -> str:
    return generate_valid_happ_link(subscription_url)
