import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    raw = (settings.OPENROUTER_CREDENTIALS_SECRET or settings.SECRET_KEY or "").encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt_openrouter_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_openrouter_secret(token: str) -> str:
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
