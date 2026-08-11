"""Allocate repair order numbers: plain 1, 2, 3… per organization."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.repair_order import RepairOrder


def allocate_repair_order_number(db: Session, organization_id: str) -> str:
    rows = (
        db.query(RepairOrder.order_number)
        .filter(RepairOrder.organization_id == organization_id)
        .all()
    )
    max_seq = 0
    for (num,) in rows:
        s = str(num or "").strip()
        if s.isdigit():
            max_seq = max(max_seq, int(s))
    return str(max_seq + 1)
