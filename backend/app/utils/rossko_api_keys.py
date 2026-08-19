"""API-ключи Rossko: хранение в rossko_settings с fallback на переменные окружения."""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.database import SessionLocal
from app.utils.avito_crypto import decrypt_secret, encrypt_secret
from app.utils.rossko_settings_db import get_or_create_rossko_settings

logger = logging.getLogger(__name__)
settings = Settings()


class RosskoApiKeysError(RuntimeError):
    """Ключи Rossko не настроены."""


def rossko_api_keys_configured(row) -> bool:
    return bool(getattr(row, "key1_encrypted", None) and getattr(row, "key2_encrypted", None))


def save_rossko_api_keys(
    db: Session,
    key1: str,
    key2: str,
    *,
    user_id: int | None = None,
) -> None:
    k1 = (key1 or "").strip()
    k2 = (key2 or "").strip()
    if not k1 or not k2:
        raise ValueError("Укажите KEY1 и KEY2 Rossko")

    row = get_or_create_rossko_settings(db)
    row.key1_encrypted = encrypt_secret(k1)
    row.key2_encrypted = encrypt_secret(k2)
    if user_id is not None:
        row.updated_by_user_id = user_id
    db.add(row)
    db.commit()
    db.refresh(row)


def _keys_from_row(row) -> tuple[str, str] | None:
    if not rossko_api_keys_configured(row):
        return None
    try:
        return decrypt_secret(row.key1_encrypted), decrypt_secret(row.key2_encrypted)
    except Exception:
        logger.exception("Failed to decrypt Rossko API keys from database")
        return None


def _keys_from_env() -> tuple[str, str] | None:
    k1 = (settings.ROSSKO_KEY1 or "").strip()
    k2 = (settings.ROSSKO_KEY2 or "").strip()
    if k1 and k2:
        return k1, k2
    return None


def get_rossko_api_keys(db: Session | None = None) -> tuple[str, str]:
    owns_session = False
    if db is None:
        db = SessionLocal()
        owns_session = True
    try:
        row = get_or_create_rossko_settings(db)
        keys = _keys_from_row(row)
        if keys:
            return keys
    finally:
        if owns_session:
            db.close()

    env_keys = _keys_from_env()
    if env_keys:
        return env_keys

    raise RosskoApiKeysError(
        "Ключи Rossko не настроены. Укажите KEY1 и KEY2 в /admin/rossko."
    )


def migrate_rossko_keys_from_env(db: Session) -> bool:
    """One-time copy from env into DB when DB keys are empty."""
    row = get_or_create_rossko_settings(db)
    if rossko_api_keys_configured(row):
        return False
    env_keys = _keys_from_env()
    if not env_keys:
        return False
    row.key1_encrypted = encrypt_secret(env_keys[0])
    row.key2_encrypted = encrypt_secret(env_keys[1])
    db.add(row)
    db.commit()
    logger.info("Migrated Rossko API keys from environment into rossko_settings")
    return True
