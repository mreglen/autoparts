from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder


def booking_slot(booking: InspectionBooking) -> datetime:
    return datetime.combine(
        booking.preferred_date,
        booking.preferred_time or time.min,
    ).replace(microsecond=0)


def covered_inspection_slots(
    db: Session,
    org_id: str,
    start_day: date | None = None,
    end_day: date | None = None,
) -> dict[tuple[int, datetime], str]:
    """Ключи (client_id, дата-время), уже закрытые заказ-нарядом: у заказа проставлена
    «Дата записи на осмотр», совпадающая со слотом записи, и тот же клиент.
    Значение — подписанный номер заказа для отчётов."""
    query = db.query(
        RepairOrder.client_id,
        RepairOrder.inspection_scheduled_at,
        RepairOrder.id,
        RepairOrder.order_number,
    ).filter(
        RepairOrder.organization_id == org_id,
        RepairOrder.client_id.isnot(None),
        RepairOrder.inspection_scheduled_at.isnot(None),
        RepairOrder.status != "cancelled",
    )
    if start_day is not None:
        query = query.filter(
            RepairOrder.inspection_scheduled_at >= datetime.combine(start_day, time.min)
        )
    if end_day is not None:
        query = query.filter(
            RepairOrder.inspection_scheduled_at
            < datetime.combine(end_day + timedelta(days=1), time.min)
        )
    return {
        (client_id, moment.replace(microsecond=0)): f"№ {order_number or order_id}"
        for client_id, moment, order_id, order_number in query.all()
    }


def filter_covered_bookings(
    bookings: list[InspectionBooking],
    slots: dict[tuple[int, datetime], str],
) -> list[InspectionBooking]:
    if not slots:
        return list(bookings)
    return [
        booking
        for booking in bookings
        if booking.client_id is None or (booking.client_id, booking_slot(booking)) not in slots
    ]


def find_covered_bookings(
    db: Session,
    org_id: str | None = None,
) -> list[tuple[InspectionBooking, str]]:
    """Записи на осмотр, которые уже отработаны заказ-нарядом (тот же клиент, то же
    дата-время) — кандидаты на удаление. Планировщик такие и так не показывает."""
    org_ids = (
        [org_id]
        if org_id
        else [row[0] for row in db.query(InspectionBooking.organization_id).distinct()]
    )
    found: list[tuple[InspectionBooking, str]] = []
    for current_org in org_ids:
        slots = covered_inspection_slots(db, current_org)
        if not slots:
            continue
        bookings = (
            db.query(InspectionBooking)
            .filter(
                InspectionBooking.organization_id == current_org,
                InspectionBooking.client_id.isnot(None),
                InspectionBooking.status.in_(("confirmed", "processed")),
            )
            .order_by(InspectionBooking.preferred_date.asc(), InspectionBooking.id.asc())
            .all()
        )
        for booking in bookings:
            order_label = slots.get((booking.client_id, booking_slot(booking)))
            if order_label:
                found.append((booking, order_label))
    return found
