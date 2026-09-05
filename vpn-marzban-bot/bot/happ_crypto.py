"""Генерация единой ссылки Happ VPN: happ://crypt4/<base64({"url":...})>."""

from __future__ import annotations

import base64
import json
import logging

logger = logging.getLogger("marzban-vpn-bot.happ")


def get_single_happ_link(sub_url: str) -> str:
    """Единственный формат ключа для бота: soft crypt4 (base64 JSON)."""
    clean_url = sub_url.strip()
    payload = {"url": clean_url}
    json_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64_str = base64.b64encode(json_bytes).decode("utf-8")
    return f"happ://crypt4/{b64_str}"


def generate_happ_crypt4(sub_url: str) -> str:
    return get_single_happ_link(sub_url)


def generate_happ_add_link(sub_url: str) -> str:
    """Оставлен для скриптов/отладки; бот его не показывает."""
    return f"happ://add/{sub_url.strip()}"


def generate_valid_happ_link(sub_url: str) -> str:
    return get_single_happ_link(sub_url)


async def generate_valid_happ_link_async(sub_url: str) -> str:
    return get_single_happ_link(sub_url)


def is_real_happ_crypto_link(link: str) -> bool:
    """Валидный ключ = soft happ://crypt4/ + JSON {"url": "..."}."""
    if not isinstance(link, str) or not link.startswith("happ://crypt4/"):
        return False
    try:
        raw = base64.b64decode(
            link[len("happ://crypt4/") :].encode("utf-8"), validate=False
        )
        data = json.loads(raw.decode("utf-8"))
        return isinstance(data.get("url"), str) and bool(data["url"].strip())
    except Exception:
        return False


def decode_happ_crypt4(link: str) -> str | None:
    if not link.startswith("happ://crypt4/"):
        return None
    try:
        raw = base64.b64decode(link[len("happ://crypt4/") :].encode("utf-8"))
        data = json.loads(raw.decode("utf-8"))
        url = data.get("url")
        return str(url).strip() if isinstance(url, str) else None
    except Exception:
        return None


def encode_happ_crypt4(subscription_url: str) -> str:
    return get_single_happ_link(subscription_url)


def encode_happ_crypto_link_sync(subscription_url: str) -> str:
    return get_single_happ_link(subscription_url)


async def encode_happ_crypto_link(subscription_url: str) -> str:
    return get_single_happ_link(subscription_url)
