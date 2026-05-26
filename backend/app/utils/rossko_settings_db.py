"""Единственная строка rossko_settings (id = 1)."""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.rossko_settings import RosskoSettings

_ROSSKO_SETTINGS_ID = 1


def get_or_create_rossko_settings(db: Session) -> RosskoSettings:
    row = db.query(RosskoSettings).filter(RosskoSettings.id == _ROSSKO_SETTINGS_ID).first()
    if row is None:
        row = RosskoSettings(
            id=_ROSSKO_SETTINGS_ID,
            contact_name="",
            contact_phone="",
            delivery_parts=False,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def get_rossko_settings(db: Session) -> RosskoSettings:
    return get_or_create_rossko_settings(db)


def update_rossko_settings(db: Session, data: dict[str, Any], user_id: int | None = None) -> RosskoSettings:
    row = get_or_create_rossko_settings(db)
    for key, value in data.items():
        if hasattr(row, key):
            setattr(row, key, value)
    if user_id is not None:
        row.updated_by_user_id = user_id
    db.commit()
    db.refresh(row)
    return row


def rossko_settings_configured(row: RosskoSettings) -> bool:
    if not row.delivery_id or row.payment_id is None:
        return False
    if row.requires_address and not row.address_id:
        return False
    if row.requires_requisite and row.requisite_id is None:
        return False
    if not (row.contact_name or "").strip() or not (row.contact_phone or "").strip():
        return False
    return True
