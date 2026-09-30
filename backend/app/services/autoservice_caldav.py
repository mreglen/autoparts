"""Синхронизация записей на осмотр в Календарь и Напоминания iPhone.

Radicale (CalDAV) хранит коллекции в файловой системе — backend пишет .ics
напрямую в storage, поэтому протокольный клиент не нужен. На каждого
сотрудника две коллекции: `inspection-events` (VEVENT → Календарь) и
`inspection-tasks` (VTODO → Напоминания). Доступ ограничен htpasswd +
owner_only на стороне Radicale.
"""
from __future__ import annotations

import json
import logging
import secrets
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException, status
from passlib.hash import apr_md5_crypt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.caldav_account import CaldavAccount
from app.models.inspection_booking import InspectionBooking
from app.models.organization import Organization
from app.models.user import User

logger = logging.getLogger(__name__)

TZ_ID = "Asia/Yekaterinburg"
EVENTS_COLLECTION = "inspection-events"
TASKS_COLLECTION = "inspection-tasks"
COLLECTION_TITLE = "Записи на осмотр"
PAST_DAYS = 30
EVENT_DURATION_MINUTES = 60
_SYNC_STATUSES = ("confirmed",)


def _storage_dir(storage_dir: str | None = None) -> Path:
    return Path(storage_dir or settings.CALDAV_STORAGE_DIR)


def _htuser_file(htuser_file: str | None = None) -> Path:
    return Path(htuser_file or settings.RADICALE_HTUSER_FILE)


def _esc(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    if len(line) <= 75:
        return line
    chunks = [line[:75]]
    rest = line[75:]
    while rest:
        chunks.append(" " + rest[:74])
        rest = rest[74:]
    return "\r\n".join(chunks)


def _ics(lines: list[str]) -> str:
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


def _dtstamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _local_dt(booking: InspectionBooking) -> datetime:
    t = booking.preferred_time
    return datetime.combine(
        booking.preferred_date,
        t if t else datetime.min.time(),
    )


def _rel_dur(delta: timedelta) -> str:
    """Относительный триггер VALARM из timedelta (например '-PT19H')."""
    total = int(delta.total_seconds())
    sign = "-" if total < 0 else ""
    total = abs(total)
    hours, rem = divmod(total, 3600)
    minutes = rem // 60
    if hours and minutes:
        body = f"{hours}H{minutes}M"
    elif hours:
        body = f"{hours}H"
    else:
        body = f"{minutes}M"
    return f"{sign}PT{body}"


def _eve_rel_trigger(booking: InspectionBooking) -> str:
    """Накануне записи в 20:00 — относительно её начала (локальное время)."""
    eve = datetime.combine(booking.preferred_date, datetime.min.time()) + timedelta(hours=20)
    eve -= timedelta(days=1)
    return _rel_dur(eve - _local_dt(booking))


def _morning_rel_trigger(booking: InspectionBooking) -> str:
    """В день записи в 9:00 — для событий без времени (начало = полночь)."""
    morning = datetime.combine(booking.preferred_date, datetime.min.time()) + timedelta(hours=9)
    return _rel_dur(morning - _local_dt(booking))


def _summary(booking: InspectionBooking) -> str:
    vehicle = " ".join(
        p for p in ((booking.vehicle_make or "").strip(), (booking.vehicle_model or "").strip()) if p
    )
    base = f"Осмотр: {booking.name}"
    return f"{base} — {vehicle}" if vehicle else base


def _description(booking: InspectionBooking) -> str:
    parts = []
    if (booking.phone or "").strip():
        parts.append(f"Телефон: {booking.phone.strip()}")
    if (booking.notes or "").strip():
        parts.append(booking.notes.strip())
    return "\n".join(parts)


def _valarm_rel(trigger: str, text: str) -> list[str]:
    return [
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        f"TRIGGER:{trigger}",
        f"DESCRIPTION:{_esc(text)}",
        "END:VALARM",
    ]


def _alarms(booking: InspectionBooking, timed: bool, text: str) -> list[str]:
    if timed:
        triggers = ["-PT15M", "-PT1H", _eve_rel_trigger(booking)]
    else:
        triggers = [_eve_rel_trigger(booking), _morning_rel_trigger(booking)]
    lines: list[str] = []
    for trig in triggers:
        lines += _valarm_rel(trig, text)
    return lines


def build_event_ics(booking: InspectionBooking, org: Organization | None) -> str:
    timed = booking.preferred_time is not None
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SvoyGarage//Inspection Bookings//RU",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        f"UID:booking-{booking.id}-event@svoygarage",
        f"DTSTAMP:{_dtstamp()}",
    ]
    if timed:
        start = _local_dt(booking)
        end = start + timedelta(minutes=EVENT_DURATION_MINUTES)
        lines.append(f"DTSTART;TZID={TZ_ID}:{start.strftime('%Y%m%dT%H%M%S')}")
        lines.append(f"DTEND;TZID={TZ_ID}:{end.strftime('%Y%m%dT%H%M%S')}")
    else:
        lines.append(f"DTSTART;VALUE=DATE:{booking.preferred_date.strftime('%Y%m%d')}")
        lines.append(
            f"DTEND;VALUE=DATE:{(booking.preferred_date + timedelta(days=1)).strftime('%Y%m%d')}"
        )
    lines.append(f"SUMMARY:{_esc(_summary(booking))}")
    address = (org.address or "").strip() if org else ""
    if address:
        lines.append(f"LOCATION:{_esc(address)}")
    lines.append(f"DESCRIPTION:{_esc(_description(booking))}")
    lines += _alarms(booking, timed, _summary(booking))
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return _ics(lines)


def build_todo_ics(booking: InspectionBooking, org: Organization | None) -> str:
    timed = booking.preferred_time is not None
    completed = booking.status == "processed"
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SvoyGarage//Inspection Bookings//RU",
        "CALSCALE:GREGORIAN",
        "BEGIN:VTODO",
        f"UID:booking-{booking.id}-todo@svoygarage",
        f"DTSTAMP:{_dtstamp()}",
    ]
    if timed:
        due = _local_dt(booking)
        lines.append(f"DUE;TZID={TZ_ID}:{due.strftime('%Y%m%dT%H%M%S')}")
        lines.append(f"DTSTART;TZID={TZ_ID}:{due.strftime('%Y%m%dT%H%M%S')}")
    else:
        lines.append(f"DUE;VALUE=DATE:{booking.preferred_date.strftime('%Y%m%d')}")
    lines.append(f"SUMMARY:{_esc(_summary(booking))}")
    lines.append(f"DESCRIPTION:{_esc(_description(booking))}")
    lines.append(f"STATUS:{'COMPLETED' if completed else 'NEEDS-ACTION'}")
    if completed:
        lines.append(f"COMPLETED:{_dtstamp()}")
    lines += _alarms(booking, timed, _summary(booking))
    lines += ["END:VTODO", "END:VCALENDAR"]
    return _ics(lines)


def _target_bookings(db: Session, organization_id: str) -> list[InspectionBooking]:
    """Только подтверждённые записи — как в планировщике. Отменённые,
    удалённые и необработанные заявки в календарь не попадают."""
    return (
        db.query(InspectionBooking)
        .filter(
            InspectionBooking.organization_id == organization_id,
            InspectionBooking.status.in_(_SYNC_STATUSES),
            InspectionBooking.preferred_date >= date.today() - timedelta(days=PAST_DAYS),
        )
        .all()
    )


def _ensure_collection(user_dir: Path, name: str, components: str) -> Path:
    coll_dir = user_dir / name
    coll_dir.mkdir(parents=True, exist_ok=True)
    props_file = coll_dir / ".Radicale.props"
    props = {
        "tag": "VCALENDAR",
        "D:displayname": COLLECTION_TITLE,
        "C:supported-calendar-component-set": components,
    }
    if not props_file.exists() or props_file.read_text(encoding="utf-8") != json.dumps(props):
        props_file.write_text(json.dumps(props, ensure_ascii=False), encoding="utf-8")
    return coll_dir


def _sync_collection(coll_dir: Path, items: dict[str, str]) -> tuple[int, int]:
    written = deleted = 0
    for fname, content in items.items():
        path = coll_dir / fname
        if not path.exists() or path.read_text(encoding="utf-8") != content:
            path.write_text(content, encoding="utf-8")
            written += 1
    for path in coll_dir.glob("*.ics"):
        if path.name not in items:
            path.unlink()
            deleted += 1
    return written, deleted


def sync_account(
    db: Session,
    account: CaldavAccount,
    *,
    storage_dir: str | None = None,
) -> dict:
    """Записать актуальный набор записей организации в коллекции сотрудника."""
    user_dir = _storage_dir(storage_dir) / account.caldav_username
    events_dir = _ensure_collection(user_dir, EVENTS_COLLECTION, "VEVENT")
    tasks_dir = _ensure_collection(user_dir, TASKS_COLLECTION, "VTODO")

    org = db.query(Organization).filter(Organization.id == account.organization_id).first()
    bookings = _target_bookings(db, account.organization_id)

    events = {
        f"b{b.id}-event.ics": build_event_ics(b, org) for b in bookings
    }
    todos = {
        f"b{b.id}-todo.ics": build_todo_ics(b, org) for b in bookings
    }

    w_e, d_e = _sync_collection(events_dir, events)
    w_t, d_t = _sync_collection(tasks_dir, todos)
    account.last_synced_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.flush()
    return {
        "username": account.caldav_username,
        "bookings": len(bookings),
        "events_written": w_e,
        "events_deleted": d_e,
        "todos_written": w_t,
        "todos_deleted": d_t,
    }


def sync_org(db: Session, organization_id: str, *, storage_dir: str | None = None) -> dict:
    accounts = (
        db.query(CaldavAccount).filter(CaldavAccount.organization_id == organization_id).all()
    )
    results, errors = [], []
    for account in accounts:
        try:
            results.append(sync_account(db, account, storage_dir=storage_dir))
        except Exception as exc:  # noqa: BLE001
            logger.exception("CalDAV sync failed for %s", account.caldav_username)
            errors.append({"username": account.caldav_username, "error": str(exc)})
    db.commit()
    return {"organization_id": organization_id, "synced": results, "errors": errors}


def sync_all(db: Session, *, storage_dir: str | None = None) -> dict:
    if not settings.CALDAV_SYNC_ENABLED:
        return {"skipped": True}
    accounts = db.query(CaldavAccount).all()
    synced, errors = 0, 0
    for account in accounts:
        try:
            sync_account(db, account, storage_dir=storage_dir)
            synced += 1
        except Exception:  # noqa: BLE001
            logger.exception("CalDAV sync failed for %s", account.caldav_username)
            errors += 1
    db.commit()
    return {"accounts": len(accounts), "synced": synced, "errors": errors}


def request_org_sync(organization_id: str) -> None:
    """Точечный синк после мутации записи: Celery, при недоступности — inline."""
    if not settings.CALDAV_SYNC_ENABLED:
        return
    try:
        from app.tasks.autoservice_caldav_tasks import sync_caldav_org_task

        sync_caldav_org_task.apply_async(args=[organization_id])
    except Exception:  # noqa: BLE001
        logger.exception("CalDAV org sync dispatch failed, falling back to inline")
        from app.db.database import SessionLocal

        db = SessionLocal()
        try:
            sync_org(db, organization_id)
        except Exception:  # noqa: BLE001
            logger.exception("CalDAV inline sync failed for org %s", organization_id)
        finally:
            db.close()


def _read_htpasswd(path: Path) -> dict[str, str]:
    lines = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if ":" in line:
                user, hashed = line.split(":", 1)
                lines[user] = hashed
    return lines


def _write_htpasswd(path: Path, entries: dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        "".join(f"{user}:{hashed}\n" for user, hashed in sorted(entries.items())),
        encoding="utf-8",
    )
    tmp.replace(path)


def _set_htpasswd_user(username: str, password: str, htuser_file: str | None = None) -> None:
    path = _htuser_file(htuser_file)
    entries = _read_htpasswd(path)
    entries[username] = apr_md5_crypt.hash(password)
    _write_htpasswd(path, entries)


def _remove_htpasswd_user(username: str, htuser_file: str | None = None) -> None:
    path = _htuser_file(htuser_file)
    entries = _read_htpasswd(path)
    if username in entries:
        del entries[username]
        _write_htpasswd(path, entries)


def provision_account(
    db: Session,
    user: User,
    organization_id: str,
    *,
    storage_dir: str | None = None,
    htuser_file: str | None = None,
) -> tuple[CaldavAccount, str]:
    if not settings.CALDAV_SYNC_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Синхронизация календаря не настроена на сервере",
        )
    existing = db.query(CaldavAccount).filter(CaldavAccount.user_id == user.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="CalDAV уже подключён — используйте «Перегенерировать пароль»",
        )
    username = f"u{user.id}"
    password = secrets.token_urlsafe(9)
    _set_htpasswd_user(username, password, htuser_file)
    account = CaldavAccount(
        user_id=user.id,
        organization_id=organization_id,
        caldav_username=username,
    )
    db.add(account)
    db.flush()
    try:
        sync_account(db, account, storage_dir=storage_dir)
    except Exception:  # noqa: BLE001
        logger.exception("CalDAV initial sync failed for %s", username)
    return account, password


def regenerate_password(
    db: Session,
    account: CaldavAccount,
    *,
    htuser_file: str | None = None,
) -> str:
    password = secrets.token_urlsafe(9)
    _set_htpasswd_user(account.caldav_username, password, htuser_file)
    return password


def disconnect_account(
    db: Session,
    account: CaldavAccount,
    *,
    storage_dir: str | None = None,
    htuser_file: str | None = None,
) -> None:
    _remove_htpasswd_user(account.caldav_username, htuser_file)
    user_dir = _storage_dir(storage_dir) / account.caldav_username
    if user_dir.exists():
        shutil.rmtree(user_dir)
    db.delete(account)
