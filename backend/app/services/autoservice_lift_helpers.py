from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.autoservice_lift import AutoserviceLift


def next_lift_name(db: Session, org_id: str) -> tuple[str, int]:
    max_sort = (
        db.query(func.max(AutoserviceLift.sort_order))
        .filter(AutoserviceLift.organization_id == org_id)
        .scalar()
    )
    next_sort = int(max_sort or 0) + 1
    return f"Подъёмник №{next_sort}", next_sort


def validate_lift_id(db: Session, org_id: str, lift_id: int | None) -> int | None:
    if lift_id is None:
        return None
    lift = (
        db.query(AutoserviceLift)
        .filter(
            AutoserviceLift.id == lift_id,
            AutoserviceLift.organization_id == org_id,
            AutoserviceLift.is_active.is_(True),
        )
        .first()
    )
    if not lift:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Подъёмник не найден или недоступен",
        )
    return lift.id


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
