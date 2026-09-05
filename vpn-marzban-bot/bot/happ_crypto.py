"""VLESS + TLS (Let's Encrypt svoygarage.ru). Основной ключ: happ://add/https://..."""

from __future__ import annotations

import base64
import json
import logging
import re
from urllib.parse import quote, unquote, urlencode, urlparse

logger = logging.getLogger("marzban-vpn-bot.happ")

_PARAM_ORDER = ("encryption", "security", "type", "sni", "fp", "alpn")
DEFAULT_TLS_SNI = "svoygarage.ru"


def normalize_vless_for_happ(
    vless_url: str,
    remark: str | None = None,
    *,
    with_flow: bool = False,
) -> str:
    """VLESS TCP + TLS: encryption=none, security=tls, sni=svoygarage.ru."""
    if not vless_url or not str(vless_url).strip().startswith("vless://"):
        return ""

    raw = str(vless_url).strip()
    if "#" in raw:
        main_part, rem = raw.split("#", 1)
        if remark is None:
            rem = re.sub(r"[^\w\s\.-]", "", unquote(rem))
            rem = re.sub(r"\s+", " ", rem).strip().replace(" ", "_") or "VPN"
            remark = rem
    else:
        main_part = raw
        if remark is None:
            remark = "VPN"

    if "Germany" in (remark or "") or "212.102.227.25" in raw:
        remark = "🇩🇪 Germany"
    elif (
        "Russia" in (remark or "")
        or "195.24.65.251" in raw
        or "svoygarage.ru" in raw
    ):
        remark = "🇷🇺 Russia"
    else:
        remark = re.sub(r"[^\w\.-]", "_", remark or "VPN")
        remark = re.sub(r"_+", "_", remark).strip("_") or "VPN"

    parsed = urlparse(main_part)
    if parsed.scheme != "vless" or not parsed.netloc:
        return ""

    # Russia: prefer domain so cert CN matches
    hostport = parsed.netloc
    if hostport.startswith("195.24.65.251"):
        hostport = hostport.replace("195.24.65.251", DEFAULT_TLS_SNI, 1)

    params = {
        "encryption": "none",
        "security": "tls",
        "type": "tcp",
        "sni": DEFAULT_TLS_SNI,
        "fp": "chrome",
        "alpn": "http/1.1",
    }
    query = urlencode([(k, params[k]) for k in _PARAM_ORDER], doseq=False)
    # Флаги и пробелы — percent-encode (Happ нормально декодирует)
    safe_remark = quote(remark, safe="")
    return f"vless://{hostport}?{query}#{safe_remark}"


def build_simple_vless_links(vless_list: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for link in vless_list:
        if not isinstance(link, str) or not link.strip():
            continue
        n = normalize_vless_for_happ(link)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def build_happ_add_link(sub_url: str) -> str:
    return f"happ://add/{sub_url.strip()}"


def build_correct_happ_crypt4(vless_urls: list[str]) -> str:
    configs = build_simple_vless_links(vless_urls)
    if not configs:
        raise ValueError("no vless")
    payload = {"configs": configs}
    b64 = base64.b64encode(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8")
    return f"happ://crypt4/{b64}"


def build_happ_crypt4(vless_list: list[str]) -> str:
    return build_correct_happ_crypt4(vless_list)


def normalize_subscription_body(raw: bytes | str) -> bytes:
    if isinstance(raw, bytes):
        text = raw.decode("utf-8", errors="replace").strip()
    else:
        text = raw.strip()
    try:
        decoded = base64.b64decode(text).decode("utf-8", errors="replace")
        lines = [ln.strip() for ln in decoded.splitlines() if ln.strip()]
    except Exception:
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    cleaned = build_simple_vless_links(lines)
    return base64.b64encode("\n".join(cleaned).encode("utf-8"))


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
    return build_happ_add_link(sub_url)


def clean_vless_url(vless_url: str) -> str:
    return normalize_vless_for_happ(vless_url)


def sanitize_vless_link(vless_url: str) -> str:
    return normalize_vless_for_happ(vless_url)


def prepare_vless_link(vless_url: str) -> str:
    return normalize_vless_for_happ(vless_url)


def _b64decode_payload(payload: str) -> bytes:
    pad = "=" * (-len(payload) % 4)
    try:
        return base64.b64decode(payload + pad, validate=False)
    except Exception:
        return base64.urlsafe_b64decode(payload + pad)


def _decode_crypt4_json(link: str) -> dict | None:
    if not isinstance(link, str) or not link.startswith("happ://crypt4/"):
        return None
    try:
        data = json.loads(
            _b64decode_payload(link[len("happ://crypt4/") :]).decode("utf-8")
        )
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def is_real_happ_crypto_link(link: str) -> bool:
    if not isinstance(link, str):
        return False
    if link.startswith("happ://add/https://"):
        return True
    if link.startswith("https://") and "/sub/" in link:
        return True
    data = _decode_crypt4_json(link)
    if not data:
        return False
    configs = data.get("configs")
    return isinstance(configs, list) and bool(configs)


def decode_happ_crypt4_configs(link: str) -> list[str] | None:
    data = _decode_crypt4_json(link)
    if not data:
        return None
    configs = data.get("configs")
    if not isinstance(configs, list):
        return None
    return [str(s).strip() for s in configs if isinstance(s, str) and s.strip()] or None


decode_happ_crypt4_servers = decode_happ_crypt4_configs


def decode_happ_crypt4(link: str) -> str | None:
    data = _decode_crypt4_json(link)
    if not data:
        return None
    url = data.get("url")
    return str(url).strip() if isinstance(url, str) else None
