from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.autoservice_work_zone import AutoserviceWorkZone


def next_work_zone_name(db: Session, org_id: str) -> tuple[str, int]:
    max_sort = (
        db.query(func.max(AutoserviceWorkZone.sort_order))
        .filter(AutoserviceWorkZone.organization_id == org_id)
        .scalar()
    )
    next_sort = int(max_sort or 0) + 1
    return f"Рабочая зона №{next_sort}", next_sort


def validate_work_zone_id(db: Session, org_id: str, work_zone_id: int | None) -> int | None:
    if work_zone_id is None:
        return None
    zone = (
        db.query(AutoserviceWorkZone)
        .filter(
            AutoserviceWorkZone.id == work_zone_id,
            AutoserviceWorkZone.organization_id == org_id,
            AutoserviceWorkZone.is_active.is_(True),
        )
        .first()
    )
    if not zone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Рабочая зона не найдена или недоступна",
        )
    return zone.id


def normalize_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.replace(tzinfo=None)
    return value


def validate_schedule_end(
    scheduled_at: datetime,
    scheduled_end_at: datetime | None,
) -> datetime | None:
    end = normalize_dt(scheduled_end_at)
    if end is None:
        return None
    start = normalize_dt(scheduled_at)
    if start and end <= start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Время окончания должно быть позже времени начала",
        )
    return end
