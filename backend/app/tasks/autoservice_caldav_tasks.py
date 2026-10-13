from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.autoservice_caldav import sync_all, sync_org, parse_ics_for_bookings, _storage_dir
from app.models.caldav_account import CaldavAccount
from app.models.inspection_booking import InspectionBooking
from app.models.user import User
from app.utils.autoservice_access import planner_zone_rights
from pathlib import Path

logger = logging.getLogger(__name__)


@celery_app.task(name="autoservice.sync_caldav_org")
def sync_caldav_org_task(organization_id: str) -> dict:
    db = SessionLocal()
    try:
        result = sync_org(db, organization_id)
        logger.info("CalDAV org sync finished: %s", result)
        return result
    finally:
        db.close()


@celery_app.task(name="autoservice.sync_caldav_all")
def sync_caldav_all_task() -> dict:
    db = SessionLocal()
    try:
        result = sync_all(db)
        logger.info("CalDAV full sync finished: %s", result)
        return result
    finally:
        db.close()


@celery_app.task(name="autoservice.sync_calendar_to_bookings")
def sync_calendar_to_bookings(user_id: int, organization_id: str) -> dict:
    """Синхронизирует события из календаря сотрудника в записи на осмотр."""
    db = SessionLocal()
    try:
        account = (
            db.query(CaldavAccount)
            .filter(
                CaldavAccount.user_id == user_id,
                CaldavAccount.organization_id == organization_id,
            )
            .first()
        )
        if not account:
            return {"error": "CalDAV account not found"}

        user = db.query(User).filter(User.id == user_id).first()
        if user is not None:
            full_access, rights = planner_zone_rights(db, user, organization_id)
            has_caldav = full_access or any(entry["can_caldav"] for entry in rights.values())
        else:
            has_caldav = False
        if not has_caldav:
            return {"error": "Нет права CalDAV на рабочие зоны"}

        storage_dir = _storage_dir()
        user_dir = storage_dir / account.caldav_username / "inspection-events"

        if not user_dir.exists():
            return {"error": "Calendar directory not found"}

        created = 0
        existing_uids = set()

        existing = (
            db.query(InspectionBooking)
            .filter(
                InspectionBooking.organization_id == organization_id,
                InspectionBooking.source == "calendar",
            )
            .all()
        )
        for booking in existing:
            if booking.notes and "uid:" in booking.notes:
                uid = booking.notes.split("uid:")[1].split("\n")[0].strip()
                existing_uids.add(uid)

        for ics_file in user_dir.glob("*.ics"):
            ics_content = ics_file.read_text(encoding="utf-8")
            bookings = parse_ics_for_bookings(ics_content, organization_id)

            for booking_data in bookings:
                uid = booking_data["uid"]

                if uid in existing_uids:
                    continue

                row = InspectionBooking(
                    organization_id=organization_id,
                    name=booking_data["name"][:120],
                    phone=booking_data["phone"],
                    preferred_date=booking_data["preferred_date"],
                    preferred_time=booking_data["preferred_time"],
                    status="new",
                    source="calendar",
                    created_by_user_id=user_id,
                    notes=f"{booking_data['notes']}\nuid: {uid}",
                )
                db.add(row)
                created += 1

        db.commit()
        return {"created": created}

    except Exception as e:
        logger.exception("Calendar sync failed for user %s", user_id)
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()

