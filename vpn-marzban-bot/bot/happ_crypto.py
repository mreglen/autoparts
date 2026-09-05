"""Генерация happ://crypt4/ (urlsafe base64) + нормализация VLESS для Happ/Sing-box."""

from __future__ import annotations

import base64
import json
import logging
import re
from urllib.parse import (
    parse_qsl,
    quote,
    unquote,
    urlencode,
    urlparse,
    urlunparse,
)

logger = logging.getLogger("marzban-vpn-bot.happ")


def normalize_vless_for_happ(vless_url: str) -> str:
    """Приводит VLESS URL к валидному стандарту Sing-box / Happ VPN."""
    if not vless_url or not vless_url.startswith("vless://"):
        return ""

    if "#" in vless_url:
        main_part, remark = vless_url.split("#", 1)
        clean_remark = re.sub(r"[^\w\s\.-]", "", unquote(remark))
        clean_remark = re.sub(r"\s+", " ", clean_remark).strip().replace(" ", "_")
        if not clean_remark:
            clean_remark = "VLESS_Server"
    else:
        main_part = vless_url
        clean_remark = "VLESS_Server"

    parsed = urlparse(main_part.strip())
    params = dict(parse_qsl(parsed.query, keep_blank_values=False))

    # Ключи в нижнем регистре, пустые значения отбрасываем
    clean_params = {str(k).lower(): v for k, v in params.items() if v}

    # Значения ключевых параметров — строго lowercase
    for key in ("security", "flow", "type", "encryption", "fp", "headerType"):
        if key in clean_params and isinstance(clean_params[key], str):
            clean_params[key] = clean_params[key].lower()

    if "encryption" not in clean_params:
        clean_params["encryption"] = "none"

    new_query = urlencode(clean_params)
    clean_main = urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            "",
        )
    )
    return f"{clean_main}#{quote(clean_remark)}"


def build_happ_crypt4(vless_list: list[str]) -> str:
    """Формирует crypt4: urlsafe base64({"configs":[...]})."""
    normalized_configs = [
        normalize_vless_for_happ(link)
        for link in vless_list
        if isinstance(link, str) and link.strip()
    ]
    normalized_configs = [c for c in normalized_configs if c]
    if not normalized_configs:
        raise ValueError("Нужен хотя бы один VLESS-конфиг для happ://crypt4/")

    payload = {"configs": normalized_configs}
    json_bytes = json.dumps(
        payload, ensure_ascii=False, separators=(",", ":")
    ).encode("utf-8")
    b64_str = base64.urlsafe_b64encode(json_bytes).decode("utf-8")
    return f"happ://crypt4/{b64_str}"


# --- aliases (бот / celery / скрипты) ---

def get_happ_crypt4(vless_list: list[str]) -> str:
    return build_happ_crypt4(vless_list)


def make_valid_happ_crypt4(vless_links: list[str]) -> str:
    return build_happ_crypt4(vless_links)


def generate_happ_crypt4_clean(vless_links: list[str]) -> str:
    return build_happ_crypt4(vless_links)


def generate_direct_happ_payload(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


def get_single_happ_link(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


def generate_happ_crypt4(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


def generate_valid_happ_link(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


async def generate_valid_happ_link_async(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


def encode_happ_crypt4(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


def encode_happ_crypto_link_sync(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


async def encode_happ_crypto_link(vless_links_list: list[str]) -> str:
    return build_happ_crypt4(vless_links_list)


def generate_happ_add_link(sub_url: str) -> str:
    return f"happ://add/{sub_url.strip()}"


def clean_vless_url(vless_url: str) -> str:
    """Совместимость: полная нормализация."""
    return normalize_vless_for_happ(vless_url)


def sanitize_vless_link(vless_url: str) -> str:
    return normalize_vless_for_happ(vless_url)


def prepare_vless_link(vless_url: str) -> str:
    return normalize_vless_for_happ(vless_url)


def _b64decode_payload(payload: str) -> bytes:
    pad = "=" * (-len(payload) % 4)
    try:
        return base64.urlsafe_b64decode(payload + pad)
    except Exception:
        return base64.b64decode(payload + pad)


def _decode_crypt4_json(link: str) -> dict | None:
    if not isinstance(link, str) or not link.startswith("happ://crypt4/"):
        return None
    try:
        raw = _b64decode_payload(link[len("happ://crypt4/") :])
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


decode_happ_crypt4_servers = decode_happ_crypt4_configs


def decode_happ_crypt4(link: str) -> str | None:
    data = _decode_crypt4_json(link)
    if not data:
        return None
    url = data.get("url")
    return str(url).strip() if isinstance(url, str) else None
