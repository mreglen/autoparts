"""Allocate human-readable repair order numbers: AS-{YYYY}-{NNNNN}."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.repair_order import RepairOrder


def allocate_repair_order_number(db: Session, when: datetime | None = None) -> str:
    now = when or datetime.now(timezone.utc)
    year = now.year
    prefix = f"AS-{year}-"
    last = (
        db.query(RepairOrder.order_number)
        .filter(RepairOrder.order_number.like(f"{prefix}%"))
        .order_by(RepairOrder.order_number.desc())
        .first()
    )
    next_seq = 1
    if last and last[0]:
        tail = str(last[0])[len(prefix) :]
        try:
            next_seq = int(tail) + 1
        except ValueError:
            next_seq = 1
    return f"{prefix}{next_seq:05d}"
