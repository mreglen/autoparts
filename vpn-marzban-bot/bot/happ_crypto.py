"""Генерация happ://crypt4/ с прямым телом {"configs":[vless://...]}."""

from __future__ import annotations

import base64
import json
import logging
from urllib.parse import quote, unquote

logger = logging.getLogger("marzban-vpn-bot.happ")


def sanitize_vless_link(link: str) -> str:
    """Кодирует fragment после # (пробелы, кириллица, эмодзи) через quote."""
    raw = link.strip()
    if "#" not in raw:
        return raw
    base, remark = raw.split("#", 1)
    # Сначала unquote, чтобы не задвоить %XX
    remark = unquote(remark)
    safe = quote(remark, safe="")
    return f"{base}#{safe}"


def get_happ_crypt4(vless_list: list[str]) -> str:
    """Soft crypt4: base64({"configs":[...]})."""
    configs = [
        sanitize_vless_link(s)
        for s in vless_list
        if isinstance(s, str) and s.strip()
    ]
    if not configs:
        raise ValueError("Нужен хотя бы один VLESS-конфиг для happ://crypt4/")
    payload = {"configs": configs}
    json_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return f"happ://crypt4/{base64.b64encode(json_bytes).decode('utf-8')}"


def generate_direct_happ_payload(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


def get_single_happ_link(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


def generate_happ_crypt4(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


def generate_happ_add_link(sub_url: str) -> str:
    """Оставлен для скриптов/отладки; бот его не показывает."""
    return f"happ://add/{sub_url.strip()}"


def generate_valid_happ_link(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


async def generate_valid_happ_link_async(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


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
    """Валидный ключ = soft crypt4 с JSON {"configs":[vless://...]}."""
    data = _decode_crypt4_json(link)
    if not data:
        return False
    configs = data.get("configs")
    if not isinstance(configs, list) or not configs:
        return False
    return all(
        isinstance(s, str) and s.strip().startswith("vless://") for s in configs
    )


def decode_happ_crypt4_configs(link: str) -> list[str] | None:
    data = _decode_crypt4_json(link)
    if not data:
        return None
    configs = data.get("configs")
    if not isinstance(configs, list):
        return None
    out = [str(s).strip() for s in configs if isinstance(s, str) and s.strip()]
    return out or None


# Alias для старых вызовов
decode_happ_crypt4_servers = decode_happ_crypt4_configs


def decode_happ_crypt4(link: str) -> str | None:
    """Legacy: url из старого формата {"url":...}."""
    data = _decode_crypt4_json(link)
    if not data:
        return None
    url = data.get("url")
    return str(url).strip() if isinstance(url, str) else None


def encode_happ_crypt4(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


def encode_happ_crypto_link_sync(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)


async def encode_happ_crypto_link(vless_links_list: list[str]) -> str:
    return get_happ_crypt4(vless_links_list)
