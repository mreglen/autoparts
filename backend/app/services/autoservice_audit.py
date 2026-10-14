from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.repair_order import RepairOrder
from app.models.user import User
from app.services.audit_service import log_audit

CATEGORY = "autoservice"

REPAIR_ORDER_STATUS_LABELS = {
    "pending": "Ожидание",
    "in_progress": "В работе",
    "done": "Выполнен",
    "review": "На проверке",
    "completed": "Закрыт",
    "cancelled": "Отменён",
}


PAYMENT_METHOD_LABELS = {
    "card": "карта",
    "cash": "наличные",
    "bank": "безнал",
}


def payment_method_label(method: Optional[str]) -> str:
    if not method:
        return "—"
    return PAYMENT_METHOD_LABELS.get(method, method)


def status_label(status: Optional[str]) -> str:
    if not status:
        return "—"
    return REPAIR_ORDER_STATUS_LABELS.get(status, status)


def client_label(name: Optional[str], phone: Optional[str] = None) -> str:
    from app.utils.autoservice_access import display_client_phone

    parts = [
        (name or "").strip(),
        display_client_phone(phone),
    ]
    return " · ".join(p for p in parts if p) or "—"


def repair_order_label(row: RepairOrder) -> str:
    number = f"№{row.order_number}" if row.order_number else f"id {row.id}"
    vehicle = row.vehicle
    make_model = ""
    if vehicle is not None:
        make_model = " ".join(p for p in (vehicle.make, vehicle.model) if p).strip()
    client_name = (getattr(row.client, "name", None) or "").strip()
    parts = [number]
    if make_model:
        parts.append(make_model)
    if client_name:
        parts.append(client_name)
    return " · ".join(parts)


def warehouse_item_label(item: Any) -> str:
    if item is None:
        return "—"
    parts = [
        (item.brand or "").strip(),
        (item.article or "").strip(),
        (item.name or "").strip(),
    ]
    return " ".join(p for p in parts if p) or f"позиция id {item.id}"


def receipt_doc_label(doc: Any) -> str:
    if doc is None:
        return "—"
    supplier = (doc.supplier_name or "").strip()
    return f"№{doc.number} ({supplier})" if supplier else f"№{doc.number}"


BOOKING_STATUS_LABELS = {
    "new": "В ожидании",
    "confirmed": "Подтверждена",
    "processed": "Обработана",
    "cancelled": "Отменена",
    "rejected": "Не подтверждена",
}


def booking_status_label(status: Optional[str]) -> str:
    if not status:
        return "—"
    return BOOKING_STATUS_LABELS.get(status, status)


def inspection_booking_label(row: Any) -> str:
    name = (row.name or "").strip() or "—"
    when = row.preferred_date.strftime("%d.%m.%Y") if row.preferred_date else "без даты"
    time_label = row.preferred_time.strftime("%H:%M") if row.preferred_time else ""
    return f"{name} · {when} {time_label}".strip()


def employee_label(employee: Any) -> str:
    parts = [
        (employee.last_name or "").strip(),
        (employee.first_name or "").strip(),
        (employee.patronymic or "").strip(),
    ]
    return " ".join(p for p in parts if p) or f"сотрудник id {employee.id}"


def zone_rights_label(assignment: Any) -> str:
    rights = [
        name
        for name, enabled in (
            ("просмотр", assignment.can_view),
            ("правка", assignment.can_edit),
            ("календарь", assignment.can_caldav),
        )
        if enabled
    ]
    return ", ".join(rights) or "без прав"


def log_autoservice(
    db: Session,
    *,
    event_type: str,
    summary: str,
    user: Optional[User],
    organization_id: Optional[str],
    entity_type: str,
    entity_id: Any = None,
    details: dict | None = None,
) -> None:
    log_audit(
        db,
        event_type=event_type,
        category=CATEGORY,
        summary=summary,
        user=user,
        organization_id=organization_id,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
