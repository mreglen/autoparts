"""Email + PWA notifications for autoservice planner and inspection bookings."""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_digest_log import AutoserviceDigestLog
from app.models.garage_vehicle import GarageVehicle
from app.models.inspection_booking import InspectionBooking
from app.models.organization import Organization
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.services.notification_service import (
    EVENT_AUTOSERVICE_APPLICATION_REVIEWED,
    EVENT_AUTOSERVICE_BOOKING_ACCEPTED,
    EVENT_AUTOSERVICE_BOOKING_CANCELLED,
    EVENT_AUTOSERVICE_BOOKING_CANCELLED_STAFF,
    EVENT_AUTOSERVICE_BOOKING_CONFIRMED,
    EVENT_AUTOSERVICE_BOOKING_REMINDER,
    EVENT_AUTOSERVICE_NEW_INSPECTION,
    EVENT_AUTOSERVICE_PLANNER_DAILY,
    dispatch_user_notification,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_INSPECTIONS,
    AUTOSERVICE_PERMISSION_PLANNER,
    has_autoservice_permission,
)

logger = logging.getLogger(__name__)

SITE_ORIGIN = "https://svoygarage.ru"
MSK = ZoneInfo("Europe/Moscow")
DIGEST_KIND_PLANNER_DAILY = "planner_daily"

INSPECTION_SOURCE_LABELS = {
    "site": "сайт",
    "client": "личный кабинет",
    "staff": "сотрудник",
}


def user_is_autoservice_staff(user: User) -> bool:
    return bool(user.is_director or user.is_seller or user.is_employee)


def list_active_autoservice_organization_ids(db: Session) -> list[str]:
    rows = (
        db.query(Organization.id)
        .filter(
            Organization.is_autoservice.is_(True),
            Organization.autoservice_paused.is_(False),
        )
        .order_by(Organization.id.asc())
        .all()
    )
    return [row[0] for row in rows]


def get_autoservice_staff_recipient_user_ids(
    db: Session,
    organization_id: str | None,
    permission: str | None = None,
) -> list[int]:
    if not organization_id:
        return []
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org or not getattr(org, "is_autoservice", False) or getattr(org, "autoservice_paused", False):
        return []
    users = db.query(User).filter(User.organization_id == organization_id).all()
    return [
        user.id
        for user in users
        if user_is_autoservice_staff(user)
        and (permission is None or has_autoservice_permission(db, user, permission))
    ]


def dispatch_org_autoservice_notification(
    db: Session,
    organization_id: str | None,
    *,
    event_type: str,
    push_data: dict | None,
    email_subject: str,
    email_body: str,
    permission: str | None = None,
) -> None:
    for user_id in get_autoservice_staff_recipient_user_ids(db, organization_id, permission):
        dispatch_user_notification(
            user_id,
            event_type=event_type,
            push_data=push_data,
            email_subject=email_subject,
            email_body=email_body,
        )


def _vehicle_label(vehicle: GarageVehicle | None) -> str:
    if not vehicle:
        return "—"
    parts = [vehicle.make, vehicle.model]
    label = " ".join(part for part in parts if part).strip()
    if vehicle.plate:
        label = f"{label} ({vehicle.plate})" if label else vehicle.plate
    return label or "—"


def _format_time(value: datetime) -> str:
    if value.tzinfo is not None:
        value = value.astimezone(MSK)
    return value.strftime("%H:%M")


def _today_msk() -> date:
    return datetime.now(MSK).date()


def _day_bounds_naive(target_date: date) -> tuple[datetime, datetime]:
    """Planner stores naive local datetimes (MSK)."""
    day_start = datetime.combine(target_date, time.min)
    day_end = day_start + timedelta(days=1)
    return day_start, day_end


def fetch_planner_orders_for_day(db: Session, organization_id: str, target_date: date) -> list[RepairOrder]:
    day_start, day_end = _day_bounds_naive(target_date)
    return (
        db.query(RepairOrder)
        .options(
            joinedload(RepairOrder.client),
            joinedload(RepairOrder.vehicle),
            joinedload(RepairOrder.work_zone),
        )
        .filter(
            RepairOrder.organization_id == organization_id,
            RepairOrder.scheduled_at >= day_start,
            RepairOrder.scheduled_at < day_end,
            RepairOrder.status != "cancelled",
        )
        .order_by(RepairOrder.scheduled_at.asc(), RepairOrder.id.asc())
        .all()
    )


def build_planner_digest_for_org(
    db: Session,
    organization_id: str,
    target_date: date,
) -> tuple[str, str, str] | None:
    orders = fetch_planner_orders_for_day(db, organization_id, target_date)
    if not orders:
        return None

    date_label = target_date.strftime("%d.%m.%Y")
    count = len(orders)
    count_label = _records_label(count)
    title = f"Планировщик на {date_label} — {count} {count_label}"
    lines = [title, ""]
    for row in orders:
        zone_name = row.work_zone.name if row.work_zone else "Без рабочей зоны"
        client_name = row.client.name if row.client else "—"
        lines.append(
            f"{_format_time(row.scheduled_at)} · ЗН-{row.order_number} · "
            f"{client_name} · {_vehicle_label(row.vehicle)} · {zone_name}"
        )
    lines.extend(["", f"Открыть: {SITE_ORIGIN}/autoservice/planner", "", "С уважением,\nСвой Гараж"])
    email_body = "\n".join(lines)
    push_body = f"{count} {count_label} на {date_label}"
    return title, push_body, email_body


def _records_label(count: int) -> str:
    mod10 = count % 10
    mod100 = count % 100
    if mod10 == 1 and mod100 != 11:
        return "запись"
    if mod10 in (2, 3, 4) and mod100 not in (12, 13, 14):
        return "записи"
    return "записей"


def _digest_already_sent(db: Session, organization_id: str, target_date: date, kind: str) -> bool:
    exists = (
        db.query(AutoserviceDigestLog.id)
        .filter(
            AutoserviceDigestLog.organization_id == organization_id,
            AutoserviceDigestLog.digest_date == target_date,
            AutoserviceDigestLog.kind == kind,
        )
        .first()
    )
    return exists is not None


def _mark_digest_sent(db: Session, organization_id: str, target_date: date, kind: str) -> None:
    db.add(
        AutoserviceDigestLog(
            organization_id=organization_id,
            digest_date=target_date,
            kind=kind,
        )
    )
    db.commit()


def send_daily_planner_digest_for_org(
    db: Session,
    organization_id: str,
    target_date: date | None = None,
) -> bool:
    target_date = target_date or _today_msk()
    if _digest_already_sent(db, organization_id, target_date, DIGEST_KIND_PLANNER_DAILY):
        logger.info(
            "Autoservice planner digest already sent for org=%s date=%s",
            organization_id,
            target_date,
        )
        return False

    digest = build_planner_digest_for_org(db, organization_id, target_date)
    if not digest:
        logger.info(
            "Autoservice planner digest skipped (no orders) for org=%s date=%s",
            organization_id,
            target_date,
        )
        return False

    title, push_body, email_body = digest
    dispatch_org_autoservice_notification(
        db,
        organization_id,
        event_type=EVENT_AUTOSERVICE_PLANNER_DAILY,
        push_data={
            "type": "autoservice_planner",
            "url": "/autoservice/planner",
            "title": title,
            "body": push_body,
        },
        email_subject=title,
        email_body=email_body,
        permission=AUTOSERVICE_PERMISSION_PLANNER,
    )
    _mark_digest_sent(db, organization_id, target_date, DIGEST_KIND_PLANNER_DAILY)
    return True


def run_daily_planner_digests(db: Session, target_date: date | None = None) -> dict:
    target_date = target_date or _today_msk()
    sent = 0
    skipped = 0
    for org_id in list_active_autoservice_organization_ids(db):
        if send_daily_planner_digest_for_org(db, org_id, target_date):
            sent += 1
        else:
            skipped += 1
    return {"target_date": target_date.isoformat(), "sent": sent, "skipped": skipped}


def _format_preferred_date(value: date) -> str:
    return value.strftime("%d.%m.%Y")


def notify_new_inspection_booking(db: Session, booking: InspectionBooking) -> None:
    if booking.source not in ("site", "client"):
        return

    source_label = INSPECTION_SOURCE_LABELS.get(booking.source, booking.source)
    title = f"Новая запись на осмотр №{booking.id}"
    vehicle_label = _vehicle_label(booking.vehicle) if booking.vehicle else None
    body_parts = [
        f"Клиент: {booking.name}, {booking.phone or '—'}",
        f"Желаемая дата: {_format_preferred_date(booking.preferred_date)}",
        f"Источник: {source_label}",
    ]
    if vehicle_label and vehicle_label != "—":
        body_parts.insert(1, f"Автомобиль: {vehicle_label}")
    push_body = " · ".join(body_parts[:2])
    email_body = (
        f"{title}\n\n"
        + "\n".join(body_parts)
        + f"\n\nОткрыть: {SITE_ORIGIN}/autoservice/inspections\n\n"
        "С уважением,\nСвой Гараж"
    )
    dispatch_org_autoservice_notification(
        db,
        booking.organization_id,
        event_type=EVENT_AUTOSERVICE_NEW_INSPECTION,
        push_data={
            "type": "autoservice_inspection",
            "url": "/autoservice/inspections",
            "inspectionId": booking.id,
            "title": title,
            "body": push_body,
        },
        email_subject=title,
        email_body=email_body,
        permission=AUTOSERVICE_PERMISSION_INSPECTIONS,
    )


def _booking_client_user_ids(db: Session, booking: InspectionBooking) -> list[int]:
    ids: set[int] = set()
    if booking.created_by_user_id:
        ids.add(int(booking.created_by_user_id))
    if booking.client_id:
        client = (
            db.query(AutoserviceClient)
            .filter(AutoserviceClient.id == booking.client_id)
            .first()
        )
        if client and client.user_id:
            ids.add(int(client.user_id))
    return sorted(ids)


def _booking_datetime_label(booking: InspectionBooking) -> str:
    label = _format_preferred_date(booking.preferred_date)
    if booking.preferred_time:
        label += f" {booking.preferred_time.strftime('%H:%M')}"
    return label


def notify_inspection_booking_client(
    db: Session,
    booking: InspectionBooking,
    kind: str,
) -> None:
    """Notify the client user linked to the booking (accepted/confirmed/cancelled)."""
    user_ids = _booking_client_user_ids(db, booking)
    if not user_ids:
        return

    org_name = booking.organization.name if booking.organization else ""
    when = _booking_datetime_label(booking)
    if kind == "accepted":
        title = "Заявка на осмотр принята"
        body = f"Заявка №{booking.id} принята, ожидайте подтверждения на {when}."
        event_type = EVENT_AUTOSERVICE_BOOKING_ACCEPTED
    elif kind == "confirmed":
        title = "Запись подтверждена"
        body = f"Запись №{booking.id} подтверждена на {when}."
        event_type = EVENT_AUTOSERVICE_BOOKING_CONFIRMED
    elif kind == "cancelled":
        title = "Запись отменена"
        body = f"Запись №{booking.id} на {when} отменена автосервисом."
        event_type = EVENT_AUTOSERVICE_BOOKING_CANCELLED
    else:
        return

    if org_name:
        body = f"{org_name}: {body}"
    push_data = {
        "type": "autoservice_inspection_client",
        "url": "/autoservice/my-bookings",
        "inspectionId": booking.id,
        "title": title,
        "body": body,
    }
    email_body = (
        f"{body}\n\n"
        f"Открыть: {SITE_ORIGIN}/autoservice/my-bookings\n\n"
        "С уважением,\nСвой Гараж"
    )
    for user_id in user_ids:
        dispatch_user_notification(
            user_id,
            event_type=event_type,
            push_data=push_data,
            email_subject=title,
            email_body=email_body,
        )


def notify_booking_cancelled_by_client(db: Session, booking: InspectionBooking) -> None:
    title = f"Клиент отменил запись №{booking.id}"
    body = f"{booking.name} отменил запись на {_booking_datetime_label(booking)}."
    dispatch_org_autoservice_notification(
        db,
        booking.organization_id,
        event_type=EVENT_AUTOSERVICE_BOOKING_CANCELLED_STAFF,
        push_data={
            "type": "autoservice_inspection",
            "url": "/autoservice/inspections",
            "inspectionId": booking.id,
            "title": title,
            "body": body,
        },
        email_subject=title,
        email_body=f"{body}\n\nОткрыть: {SITE_ORIGIN}/autoservice/inspections\n\nС уважением,\nСвой Гараж",
        permission=AUTOSERVICE_PERMISSION_INSPECTIONS,
    )


def _booking_reminder_kind(booking_id: int) -> str:
    return f"booking_reminder:{booking_id}"


def _booking_reminder_sent(db: Session, booking: InspectionBooking) -> bool:
    exists = (
        db.query(AutoserviceDigestLog.id)
        .filter(
            AutoserviceDigestLog.organization_id == booking.organization_id,
            AutoserviceDigestLog.digest_date == booking.preferred_date,
            AutoserviceDigestLog.kind == _booking_reminder_kind(booking.id),
        )
        .first()
    )
    return exists is not None


def _mark_booking_reminder_sent(db: Session, booking: InspectionBooking) -> None:
    db.add(
        AutoserviceDigestLog(
            organization_id=booking.organization_id,
            digest_date=booking.preferred_date,
            kind=_booking_reminder_kind(booking.id),
        )
    )
    db.commit()


def send_booking_reminder(db: Session, booking: InspectionBooking) -> bool:
    if _booking_reminder_sent(db, booking):
        return False
    user_ids = _booking_client_user_ids(db, booking)
    if not user_ids:
        return False

    org_name = booking.organization.name if booking.organization else ""
    title = "Напоминание о записи"
    body = f"Завтра {_booking_datetime_label(booking)} — запись №{booking.id}."
    if org_name:
        body = f"{org_name}: {body}"
    for user_id in user_ids:
        dispatch_user_notification(
            user_id,
            event_type=EVENT_AUTOSERVICE_BOOKING_REMINDER,
            push_data={
                "type": "autoservice_inspection_client",
                "url": "/autoservice/my-bookings",
                "inspectionId": booking.id,
                "title": title,
                "body": body,
            },
            email_subject=title,
            email_body=f"{body}\n\nОткрыть: {SITE_ORIGIN}/autoservice/my-bookings\n\nС уважением,\nСвой Гараж",
        )
    _mark_booking_reminder_sent(db, booking)
    return True


def run_booking_reminders(db: Session, target_date: date | None = None) -> dict:
    """Notify clients one day before confirmed/pending bookings."""
    target = target_date or (_today_msk() + timedelta(days=1))
    rows = (
        db.query(InspectionBooking)
        .options(
            joinedload(InspectionBooking.organization),
            joinedload(InspectionBooking.vehicle),
        )
        .filter(
            InspectionBooking.preferred_date == target,
            InspectionBooking.status.in_(("new", "confirmed")),
        )
        .all()
    )
    sent = 0
    for booking in rows:
        try:
            if send_booking_reminder(db, booking):
                sent += 1
        except Exception:
            logger.exception("Booking reminder failed for booking %s", booking.id)
    return {"target_date": target.isoformat(), "sent": sent}


def notify_tariff_application_reviewed(
    db: Session,
    *,
    application,
    org: Organization | None,
    approved: bool,
) -> None:
    """Notify organization directors about approve/reject of the tariff application."""
    if org is None:
        org = (
            db.query(Organization)
            .filter(Organization.id == application.organization_id)
            .first()
        )
    org_name = org.name if org else application.organization_id
    if approved:
        title = "Заявка на тариф одобрена"
        body = f"Заявка №{application.id} одобрена — тариф подключён."
    else:
        title = "Заявка на тариф отклонена"
        reason = getattr(application, "rejection_reason", None) or "Причина не указана"
        body = f"Заявка №{application.id} отклонена. Причина: {reason}."

    body = f"{org_name}: {body}"
    recipients = (
        db.query(User.id)
        .filter(
            User.organization_id == application.organization_id,
            User.is_director.is_(True),
        )
        .all()
    )
    for (user_id,) in recipients:
        dispatch_user_notification(
            user_id,
            event_type=EVENT_AUTOSERVICE_APPLICATION_REVIEWED,
            push_data={
                "type": "autoservice_application",
                "url": "/autoservice/tariff",
                "applicationId": application.id,
                "title": title,
                "body": body,
            },
            email_subject=title,
            email_body=f"{body}\n\nОткрыть: {SITE_ORIGIN}/autoservice\n\nС уважением,\nСвой Гараж",
        )
