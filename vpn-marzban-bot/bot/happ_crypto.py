"""Шифрование ссылки подписки для Happ VPN (crypt4/crypt5).

Простой base64(JSON) Happ отклоняет как «ключ не валиден».
Официально: POST https://crypto.happ.su/api-v2.php {"url": "..."}.
Локальный fallback: RSA-4096 PKCS1v15 → happ://crypt4/...
"""

from __future__ import annotations

import base64
import logging
from functools import lru_cache

import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding

logger = logging.getLogger("marzban-vpn-bot.happ")

HAPP_CRYPTO_API = "https://crypto.happ.su/api-v2.php"

# Публичный ключ из https://www.happ.su/main/dev-docs/crypto-link (deprecated local path)
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


def encode_happ_crypt4_local(subscription_url: str) -> str:
    """Локальное RSA-4096 → happ://crypt4/... (официальный deprecated fallback)."""
    ciphertext = _public_key().encrypt(
        subscription_url.encode("utf-8"),
        padding.PKCS1v15(),
    )
    return f"happ://crypt4/{base64.b64encode(ciphertext).decode('ascii')}"


def is_real_happ_crypto_link(link: str) -> bool:
    """Настоящий crypt-link (не наш старый base64 JSON)."""
    if not link.startswith("happ://crypt"):
        return False
    # Старый баг: base64(`{"url":...}`) начинается с eyJ
    payload = link.split("/", 3)[-1]
    if payload.startswith("eyJ"):
        return False
    return True


async def encode_happ_crypto_link(subscription_url: str) -> str:
    """
    Шифрует subscription URL для Happ.
    Предпочтительно официальный API (обычно crypt5), иначе локальный crypt4.
    """
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                HAPP_CRYPTO_API,
                json={"url": subscription_url},
                headers={"Content-Type": "application/json"},
            )
        if response.status_code == 200:
            data = response.json()
            link = (
                data.get("encrypted_link")
                or data.get("encryptedLink")
                or data.get("link")
            )
            if isinstance(link, str) and link.startswith("happ://crypt"):
                logger.info("Happ crypto API → %s…", link[:28])
                return link
            logger.warning("Happ crypto API unexpected body: %s", data)
        else:
            logger.warning(
                "Happ crypto API HTTP %s: %s",
                response.status_code,
                response.text[:200],
            )
    except Exception as exc:
        logger.warning("Happ crypto API failed: %s — fallback to local RSA crypt4", exc)

    link = encode_happ_crypt4_local(subscription_url)
    logger.info("Happ local RSA crypt4 → %s…", link[:28])
    return link


def encode_happ_crypto_link_sync(subscription_url: str) -> str:
    """Синхронная обёртка (Celery / скрипты)."""
    try:
        with httpx.Client(timeout=25.0) as client:
            response = client.post(
                HAPP_CRYPTO_API,
                json={"url": subscription_url},
                headers={"Content-Type": "application/json"},
            )
        if response.status_code == 200:
            data = response.json()
            link = (
                data.get("encrypted_link")
                or data.get("encryptedLink")
                or data.get("link")
            )
            if isinstance(link, str) and link.startswith("happ://crypt"):
                return link
    except Exception as exc:
        logger.warning("Happ crypto API sync failed: %s", exc)

    return encode_happ_crypt4_local(subscription_url)


# Обратная совместимость имени из ТЗ (теперь — настоящий crypto, не base64 JSON)
def encode_happ_crypt4(subscription_url: str) -> str:
    return encode_happ_crypto_link_sync(subscription_url)
