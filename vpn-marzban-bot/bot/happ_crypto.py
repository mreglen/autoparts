"""Шифрование ссылки подписки для Happ VPN.

Официально (https://www.happ.su/main/dev-docs/crypto-link):
  happ://crypt4/ — RSA-4096, либо API https://crypto.happ.su/api-v2.php

Важно: base64(JSON {"url": ...}) → happ://crypt4/eyJ... Happ отклоняет
как «ключ не валиден». Это не валидный crypt4.
"""

from __future__ import annotations

import base64
import json
import logging
from functools import lru_cache

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding

logger = logging.getLogger("marzban-vpn-bot.happ")

HAPP_CRYPTO_API = "https://crypto.happ.su/api-v2.php"

# Публичный ключ из документации Happ (локальный fallback, deprecated у вендора)
HAPP_RSA4096_PUBLIC_PEM = """-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAlBetA0wjbaj+h7oJ/d/h
pNrXvAcuhOdFGEFcfCxSWyLzWk4SAQ05gtaEGZyetTax2uqagi9HT6lapUSUe2S8
nMLJf5K+LEs9TYrhhBdx/B0BGahA+lPJa7nUwp7WfUmSF4hir+xka5ApHjzkAQn6
cdG6FKtSPgq1rYRPd1jRf2maEHwiP/e/jqdXLPP0SFBjWTMt/joUDgE7v/IGGB0L
Q7mGPAlgmxwUHVqP4bJnZ//5sNLxWMjtYHOYjaV+lixNSfhFM3MdBndjpkmgSfmg
D5uYQYDL29TDk6Eu+xetUEqry8ySPjUbNWdDXCglQWMxDGjaqYXMWgxBA1UKjUBW
wbgr5yKTJ7mTqhlYEC9D5V/LOnKd6pTSvaMxkHXwk8hBWvUNWAxzAf5JZ7EVE3jt
0j682+/hnmL/hymUE44yMG1gCcWvSpB3BTlKoMnl4yrTakmdkbASeFRkN3iMRewa
IenvMhzJh1fq7xwX94otdd5eLB2vRFavrnhOcN2JJAkKTnx9dwQwFpGEkg+8U613
+Tfm/f82l56fFeoFN98dD2mUFLFZoeJ5CG81ZeXrH83niI0joX7rtoAZIPWzq3Y1
Zb/Zq+kK2hSIhphY172Uvs8X2Qp2ac9UoTPM71tURsA9IvPNvUwSIo/aKlX5KE3I
VE0tje7twWXL5Gb1sfcXRzsCAwEAAQ==
-----END PUBLIC KEY-----
"""


@lru_cache(maxsize=1)
def _public_key():
    return serialization.load_pem_public_key(HAPP_RSA4096_PUBLIC_PEM.encode("utf-8"))


def _legacy_json_base64_crypt4(sub_url: str) -> str:
    """
    Старый «мягкий» формат base64(JSON).
    Happ на практике отвечает «ключ не валиден» — не использовать для выдачи.
    Оставлен только для детекта/миграции старых ссылок.
    """
    clean_url = sub_url.strip()
    payload = {"url": clean_url}
    json_str = json.dumps(payload, separators=(",", ":"))
    base64_str = base64.b64encode(json_str.encode("utf-8")).decode("utf-8")
    return f"happ://crypt4/{base64_str}"


def encode_happ_crypt4_local(subscription_url: str) -> str:
    """Локальное RSA-4096 PKCS1v15 → настоящий happ://crypt4/..."""
    ciphertext = _public_key().encrypt(
        subscription_url.strip().encode("utf-8"),
        padding.PKCS1v15(),
    )
    return f"happ://crypt4/{base64.b64encode(ciphertext).decode('ascii')}"


def is_real_happ_crypto_link(link: str) -> bool:
    """Настоящий crypt-link (не base64 JSON eyJ...)."""
    if not isinstance(link, str) or not link.startswith("happ://crypt"):
        return False
    payload = link.split("/", 3)[-1]
    # base64(`{"url":...}`) всегда начинается с eyJ
    if payload.startswith("eyJ"):
        return False
    return True


def generate_valid_happ_link(sub_url: str) -> str:
    """
    Генерирует 100% валидную ссылку для Happ VPN.

    Принимает: sub_url (строку вида https://domain.com/sub/token)
    Возвращает: валидную ссылку happ://crypt4/... или happ://crypt5/...

    1) Очищает URL
    2) Шифрует через официальный API Happ (предпочтительно)
    3) Fallback: локальный RSA-4096 → happ://crypt4/...

    Не использует base64(JSON) — Happ его отклоняет.
    """
    clean_url = sub_url.strip()
    if not clean_url:
        raise ValueError("sub_url пустой")

    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.post(
                HAPP_CRYPTO_API,
                json={"url": clean_url},
                headers={"Content-Type": "application/json"},
            )
        if response.status_code == 200:
            data = response.json()
            link = (
                data.get("encrypted_link")
                or data.get("encryptedLink")
                or data.get("link")
            )
            if isinstance(link, str) and is_real_happ_crypto_link(link):
                logger.info("generate_valid_happ_link API → %s…", link[:32])
                return link
            logger.warning("Happ crypto API unexpected body: %s", data)
        else:
            logger.warning(
                "Happ crypto API HTTP %s: %s",
                response.status_code,
                response.text[:200],
            )
    except Exception as exc:
        logger.warning("Happ crypto API failed: %s — RSA crypt4 fallback", exc)

    link = encode_happ_crypt4_local(clean_url)
    logger.info("generate_valid_happ_link local crypt4 → %s…", link[:32])
    return link


async def generate_valid_happ_link_async(sub_url: str) -> str:
    """Async-версия generate_valid_happ_link для aiogram."""
    clean_url = sub_url.strip()
    if not clean_url:
        raise ValueError("sub_url пустой")

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                HAPP_CRYPTO_API,
                json={"url": clean_url},
                headers={"Content-Type": "application/json"},
            )
        if response.status_code == 200:
            data = response.json()
            link = (
                data.get("encrypted_link")
                or data.get("encryptedLink")
                or data.get("link")
            )
            if isinstance(link, str) and is_real_happ_crypto_link(link):
                logger.info("generate_valid_happ_link async API → %s…", link[:32])
                return link
            logger.warning("Happ crypto API unexpected body: %s", data)
        else:
            logger.warning(
                "Happ crypto API HTTP %s: %s",
                response.status_code,
                response.text[:200],
            )
    except Exception as exc:
        logger.warning("Happ crypto API async failed: %s — RSA crypt4 fallback", exc)

    return encode_happ_crypt4_local(clean_url)


# Алиасы для остального кода бота
def encode_happ_crypto_link_sync(subscription_url: str) -> str:
    return generate_valid_happ_link(subscription_url)


async def encode_happ_crypto_link(subscription_url: str) -> str:
    return await generate_valid_happ_link_async(subscription_url)


def encode_happ_crypt4(subscription_url: str) -> str:
    return generate_valid_happ_link(subscription_url)
