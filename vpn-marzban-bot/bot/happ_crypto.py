"""Генерация happ://crypt4/ с прямым телом серверов (без URL /sub/)."""

from __future__ import annotations

import base64
import json
import logging

logger = logging.getLogger("marzban-vpn-bot.happ")


def generate_direct_happ_payload(vless_links_list: list[str]) -> str:
    """
    Упаковывает массив VLESS-ссылок напрямую в soft crypt4.
    Happ читает конфиги без обращения к веб-серверу (как MabiksVPN).
    """
    servers = [s.strip() for s in vless_links_list if isinstance(s, str) and s.strip()]
    if not servers:
        raise ValueError("Нужен хотя бы один VLESS-конфиг для happ://crypt4/")
    payload = {"servers": servers}
    json_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64_str = base64.b64encode(json_bytes).decode("utf-8")
    return f"happ://crypt4/{b64_str}"


def get_single_happ_link(vless_links_list: list[str]) -> str:
    """Единая точка входа бота: прямое тело servers."""
    return generate_direct_happ_payload(vless_links_list)


def generate_happ_crypt4(vless_links_list: list[str]) -> str:
    return generate_direct_happ_payload(vless_links_list)


def generate_happ_add_link(sub_url: str) -> str:
    """Оставлен для скриптов/отладки; бот его не показывает."""
    return f"happ://add/{sub_url.strip()}"


def generate_valid_happ_link(vless_links_list: list[str]) -> str:
    return generate_direct_happ_payload(vless_links_list)


async def generate_valid_happ_link_async(vless_links_list: list[str]) -> str:
    return generate_direct_happ_payload(vless_links_list)


def _decode_crypt4_json(link: str) -> dict | None:
    if not isinstance(link, str) or not link.startswith("happ://crypt4/"):
        return None
    try:
        raw = base64.b64decode(
            link[len("happ://crypt4/") :].encode("utf-8"), validate=False
        )
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def is_real_happ_crypto_link(link: str) -> bool:
    """Валидный ключ = soft crypt4 с JSON {"servers":[vless://...]}."""
    data = _decode_crypt4_json(link)
    if not data:
        return False
    servers = data.get("servers")
    if not isinstance(servers, list) or not servers:
        return False
    return all(
        isinstance(s, str) and s.strip().startswith("vless://") for s in servers
    )


def decode_happ_crypt4_servers(link: str) -> list[str] | None:
    data = _decode_crypt4_json(link)
    if not data:
        return None
    servers = data.get("servers")
    if not isinstance(servers, list):
        return None
    out = [str(s).strip() for s in servers if isinstance(s, str) and s.strip()]
    return out or None


def decode_happ_crypt4(link: str) -> str | None:
    """Legacy: url из старого формата {"url":...}; для servers — None."""
    data = _decode_crypt4_json(link)
    if not data:
        return None
    url = data.get("url")
    return str(url).strip() if isinstance(url, str) else None


def encode_happ_crypt4(vless_links_list: list[str]) -> str:
    return generate_direct_happ_payload(vless_links_list)


def encode_happ_crypto_link_sync(vless_links_list: list[str]) -> str:
    return generate_direct_happ_payload(vless_links_list)


async def encode_happ_crypto_link(vless_links_list: list[str]) -> str:
    return generate_direct_happ_payload(vless_links_list)
