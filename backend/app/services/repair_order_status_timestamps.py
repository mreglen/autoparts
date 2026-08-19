from __future__ import annotations

from datetime import datetime, timezone

from app.models.repair_order import RepairOrder
from app.schemas.repair_order import LEGACY_STATUS_MAP

STATUS_TIMESTAMP_FIELDS = {
    "pending": "status_pending_at",
    "in_progress": "status_in_progress_at",
    "done": "status_done_at",
    "completed": "status_completed_at",
    "cancelled": "status_cancelled_at",
}


def normalize_repair_order_status(status: str) -> str:
    return LEGACY_STATUS_MAP.get(status, status)


def record_repair_order_status_timestamp(
    order: RepairOrder,
    status: str,
    *,
    at: datetime | None = None,
) -> None:
    """Persist when the order entered the given status (stored only, not exposed in UI yet)."""
    normalized = normalize_repair_order_status(status)
    field_name = STATUS_TIMESTAMP_FIELDS.get(normalized)
    if not field_name:
        return
    timestamp = at or datetime.now(timezone.utc).replace(tzinfo=None)
    setattr(order, field_name, timestamp)
