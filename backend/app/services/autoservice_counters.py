"""Atomic per-organization counters backed by a locked counter row."""
from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.autoservice_counter import AutoserviceCounter
from app.models.autoservice_payment import AutoservicePayment
from app.models.repair_order import RepairOrder

COUNTER_REPAIR_ORDER = "repair_order"
COUNTER_AUTOSERVICE_PAYMENT = "autoservice_payment"


def _initial_value(db: Session, organization_id: str, kind: str) -> int:
    """Seed a fresh counter from the current maximum already stored."""
    if kind == COUNTER_AUTOSERVICE_PAYMENT:
        current = (
            db.query(func.max(AutoservicePayment.sequential_number))
            .filter(AutoservicePayment.organization_id == organization_id)
            .scalar()
        )
        return int(current or 0)
    if kind == COUNTER_REPAIR_ORDER:
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
        return max_seq
    raise ValueError(f"Unknown autoservice counter kind: {kind}")


def next_counter_value(db: Session, organization_id: str, kind: str) -> int:
    """Return the next counter value, serializing concurrent allocations."""
    row = (
        db.query(AutoserviceCounter)
        .filter(
            AutoserviceCounter.organization_id == organization_id,
            AutoserviceCounter.kind == kind,
        )
        .with_for_update()
        .first()
    )
    if row is None:
        row = AutoserviceCounter(
            organization_id=organization_id,
            kind=kind,
            value=_initial_value(db, organization_id, kind),
        )
        try:
            with db.begin_nested():
                db.add(row)
                db.flush()
        except IntegrityError:
            row = (
                db.query(AutoserviceCounter)
                .filter(
                    AutoserviceCounter.organization_id == organization_id,
                    AutoserviceCounter.kind == kind,
                )
                .with_for_update()
                .one()
            )
    row.value = int(row.value or 0) + 1
    db.flush()
    return int(row.value)
