"""Генерация ссылок Happ VPN.

Официальный Happ принимает:
  - happ://crypt5/... (RSA через https://crypto.happ.su/api-v2.php)
  - happ://add/<https://.../sub/token>
  - прямую https://.../sub/token
Soft happ://crypt4/eyJ... (base64 JSON) часто даёт «Ключ не является валидным».
"""

from __future__ import annotations

import base64
import json
import logging

import httpx

logger = logging.getLogger("marzban-vpn-bot.happ")

HAPP_CRYPTO_API = "https://crypto.happ.su/api-v2.php"


def generate_happ_crypt4(sub_url: str) -> str:
    """Soft crypt4 (base64 JSON) — по ТЗ; Happ может отклонять."""
    clean_url = sub_url.strip()
    payload = {"url": clean_url}
    json_bytes = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    b64_str = base64.b64encode(json_bytes).decode("utf-8")
    return f"happ://crypt4/{b64_str}"


def generate_happ_add_link(sub_url: str) -> str:
    return f"happ://add/{sub_url.strip()}"


def generate_happ_official_crypto(sub_url: str) -> str:
    """Официальное шифрование Happ (обычно crypt5)."""
    clean_url = sub_url.strip()
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = client.post(
                HAPP_CRYPTO_API,
                json={"url": clean_url},
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code == 200:
            data = resp.json()
            link = (
                data.get("encrypted_link")
                or data.get("encryptedLink")
                or data.get("link")
            )
            if isinstance(link, str) and link.startswith("happ://crypt"):
                logger.info("Happ official crypto → %s…", link[:36])
                return link
            logger.warning("Happ API unexpected: %s", data)
    except Exception as exc:
        logger.warning("Happ API failed: %s", exc)
    # fallback soft crypt4
    return generate_happ_crypt4(clean_url)


async def generate_happ_official_crypto_async(sub_url: str) -> str:
    clean_url = sub_url.strip()
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                HAPP_CRYPTO_API,
                json={"url": clean_url},
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code == 200:
            data = resp.json()
            link = (
                data.get("encrypted_link")
                or data.get("encryptedLink")
                or data.get("link")
            )
            if isinstance(link, str) and link.startswith("happ://crypt"):
                logger.info("Happ official crypto async → %s…", link[:36])
                return link
    except Exception as exc:
        logger.warning("Happ API async failed: %s", exc)
    return generate_happ_crypt4(clean_url)


def generate_valid_happ_link(sub_url: str) -> str:
    """Для хранения в БД: официальный crypto (рабочий для Happ)."""
    return generate_happ_official_crypto(sub_url)


async def generate_valid_happ_link_async(sub_url: str) -> str:
    return await generate_happ_official_crypto_async(sub_url)


def is_real_happ_crypto_link(link: str) -> bool:
    """Рабочий ключ Happ: crypt5/официальный crypt ИЛИ soft crypt4 JSON."""
    if not isinstance(link, str) or not link.startswith("happ://crypt"):
        return False
    # soft crypt4
    if link.startswith("happ://crypt4/"):
        try:
            raw = base64.b64decode(
                link[len("happ://crypt4/") :].encode("utf-8"), validate=False
            )
            data = json.loads(raw.decode("utf-8"))
            return isinstance(data.get("url"), str) and bool(data["url"].strip())
        except Exception:
            return False
    # official crypt5/crypt4 RSA payload — не eyJ
    payload = link.split("/", 3)[-1]
    return bool(payload) and not payload.startswith("eyJ")


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
    return generate_happ_official_crypto(subscription_url)


def encode_happ_crypto_link_sync(subscription_url: str) -> str:
    return generate_happ_official_crypto(subscription_url)


async def encode_happ_crypto_link(subscription_url: str) -> str:
    return await generate_happ_official_crypto_async(subscription_url)
