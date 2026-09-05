"""Генерация ссылок Happ VPN."""

from __future__ import annotations

import base64
import json
import logging

logger = logging.getLogger("marzban-vpn-bot.happ")


def generate_happ_crypt4(sub_url: str) -> str:
    """
    Формирует happ://crypt4/<base64(JSON{"url":...})>.

    Алгоритм (как в ТЗ):
      payload = {"url": clean_url}
      json → base64 → happ://crypt4/...
    """
    clean_url = sub_url.strip()
    payload = {"url": clean_url}
    json_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64_str = base64.b64encode(json_bytes).decode("utf-8")
    return f"happ://crypt4/{b64_str}"


def generate_happ_add_link(sub_url: str) -> str:
    """
    Deeplink, который официальный Happ принимает без RSA:
    happ://add/<subscription_url>
    (без encodeURIComponent — иначе Happ пишет URL not valid).
    """
    return f"happ://add/{sub_url.strip()}"


def generate_valid_happ_link(sub_url: str) -> str:
    """Основная crypt4-ссылка для хранения в БД."""
    link = generate_happ_crypt4(sub_url)
    logger.info("generate_happ_crypt4 → %s…", link[:48])
    return link


async def generate_valid_happ_link_async(sub_url: str) -> str:
    return generate_valid_happ_link(sub_url)


def is_real_happ_crypto_link(link: str) -> bool:
    """crypt4 с декодируемым {"url": "..."}."""
    if not isinstance(link, str) or not link.startswith("happ://crypt4/"):
        return False
    try:
        raw = base64.b64decode(
            link[len("happ://crypt4/") :].encode("utf-8"), validate=False
        )
        data = json.loads(raw.decode("utf-8"))
        url = data.get("url")
        return isinstance(url, str) and bool(url.strip())
    except Exception:
        return False


def decode_happ_crypt4(link: str) -> str | None:
    if not is_real_happ_crypto_link(link):
        return None
    raw = base64.b64decode(link[len("happ://crypt4/") :].encode("utf-8"))
    data = json.loads(raw.decode("utf-8"))
    return str(data["url"]).strip()


def encode_happ_crypt4(subscription_url: str) -> str:
    return generate_happ_crypt4(subscription_url)


def encode_happ_crypto_link_sync(subscription_url: str) -> str:
    return generate_happ_crypt4(subscription_url)


async def encode_happ_crypto_link(subscription_url: str) -> str:
    return generate_happ_crypt4(subscription_url)
