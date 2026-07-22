"""Runtime SEO sync rate settings: DB overrides over env defaults."""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.seo_new_parts_sync_settings import SeoNewPartsSyncSettings

_SETTINGS_ID = 1

OVERRIDE_FIELDS = (
    "daily_limit",
    "batch_interval_minutes",
    "batch_size",
    "rossko_delay_sec",
    "seed_precheck_daily",
    "seed_precheck_interval_minutes",
)


@dataclass(frozen=True)
class EffectiveSeoSyncSettings:
    daily_limit: int
    batch_interval_minutes: int
    batch_size: int  # configured; 0 = auto
    rossko_delay_sec: float
    seed_precheck_daily: int
    seed_precheck_interval_minutes: int

    def resolved_batch_size(self) -> int:
        configured = int(self.batch_size or 0)
        if configured > 0:
            return configured
        interval_minutes = max(1, int(self.batch_interval_minutes or 30))
        ticks_per_day = max(1, (24 * 60) // interval_minutes)
        return max(1, math.ceil(int(self.daily_limit) / ticks_per_day))


def env_seo_sync_defaults() -> dict[str, Any]:
    return {
        "daily_limit": int(settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT or 1000),
        "batch_interval_minutes": max(1, int(settings.NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES or 30)),
        "batch_size": int(settings.NEW_PARTS_SEO_SYNC_BATCH_SIZE or 0),
        "rossko_delay_sec": float(settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC or 0),
        "seed_precheck_daily": int(settings.NEW_PARTS_SEO_SEED_PRECHECK_DAILY or 0),
        "seed_precheck_interval_minutes": max(
            1, int(settings.NEW_PARTS_SEO_SEED_PRECHECK_INTERVAL_MINUTES or 30)
        ),
    }


def get_or_create_seo_sync_settings_row(db: Session) -> SeoNewPartsSyncSettings:
    row = (
        db.query(SeoNewPartsSyncSettings)
        .filter(SeoNewPartsSyncSettings.id == _SETTINGS_ID)
        .first()
    )
    if row is None:
        row = SeoNewPartsSyncSettings(id=_SETTINGS_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _coerce_override(field: str, value: Any) -> Any:
    if value is None:
        return None
    if field == "rossko_delay_sec":
        return float(value)
    return int(value)


def resolve_effective_seo_sync_settings(db: Session | None = None) -> EffectiveSeoSyncSettings:
    defaults = env_seo_sync_defaults()
    if db is None:
        return EffectiveSeoSyncSettings(**defaults)

    row = get_or_create_seo_sync_settings_row(db)
    values: dict[str, Any] = {}
    for field in OVERRIDE_FIELDS:
        override = getattr(row, field, None)
        values[field] = defaults[field] if override is None else override
    return EffectiveSeoSyncSettings(
        daily_limit=max(1, int(values["daily_limit"])),
        batch_interval_minutes=max(1, int(values["batch_interval_minutes"])),
        batch_size=max(0, int(values["batch_size"])),
        rossko_delay_sec=max(0.0, float(values["rossko_delay_sec"])),
        seed_precheck_daily=max(0, int(values["seed_precheck_daily"])),
        seed_precheck_interval_minutes=max(1, int(values["seed_precheck_interval_minutes"])),
    )


def get_seo_sync_settings_payload(db: Session) -> dict[str, Any]:
    defaults = env_seo_sync_defaults()
    row = get_or_create_seo_sync_settings_row(db)
    overrides: dict[str, Any] = {}
    sources: dict[str, str] = {}
    for field in OVERRIDE_FIELDS:
        override = getattr(row, field, None)
        if override is None:
            sources[field] = "env"
        else:
            overrides[field] = override
            sources[field] = "db"

    effective = resolve_effective_seo_sync_settings(db)
    return {
        "effective": {
            **asdict(effective),
            "resolved_batch_size": effective.resolved_batch_size(),
        },
        "defaults": defaults,
        "overrides": overrides,
        "sources": sources,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def update_seo_sync_settings(
    db: Session,
    payload: dict[str, Any],
    *,
    user_id: int | None = None,
) -> dict[str, Any]:
    row = get_or_create_seo_sync_settings_row(db)
    for field in OVERRIDE_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        if value is None:
            setattr(row, field, None)
            continue
        setattr(row, field, _coerce_override(field, value))
    if user_id is not None:
        row.updated_by_user_id = user_id
    db.commit()
    db.refresh(row)
    return get_seo_sync_settings_payload(db)


def reset_seo_sync_settings(db: Session, *, user_id: int | None = None) -> dict[str, Any]:
    row = get_or_create_seo_sync_settings_row(db)
    for field in OVERRIDE_FIELDS:
        setattr(row, field, None)
    if user_id is not None:
        row.updated_by_user_id = user_id
    db.commit()
    db.refresh(row)
    return get_seo_sync_settings_payload(db)


def validate_seo_sync_settings_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return cleaned partial payload or raise ValueError."""
    cleaned: dict[str, Any] = {}
    for field in OVERRIDE_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        if value is None:
            cleaned[field] = None
            continue
        if field == "rossko_delay_sec":
            num = float(value)
            if num < 0:
                raise ValueError("rossko_delay_sec must be >= 0")
            cleaned[field] = num
            continue
        num_i = int(value)
        if field in ("daily_limit", "batch_interval_minutes", "seed_precheck_interval_minutes"):
            if num_i < 1:
                raise ValueError(f"{field} must be >= 1")
        elif field in ("batch_size", "seed_precheck_daily"):
            if num_i < 0:
                raise ValueError(f"{field} must be >= 0")
        cleaned[field] = num_i
    return cleaned
