"""Allocate repair order numbers: plain 1, 2, 3… per organization."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.services.autoservice_counters import (
    COUNTER_REPAIR_ORDER,
    next_counter_value,
)


def allocate_repair_order_number(db: Session, organization_id: str) -> str:
    return str(next_counter_value(db, organization_id, COUNTER_REPAIR_ORDER))
