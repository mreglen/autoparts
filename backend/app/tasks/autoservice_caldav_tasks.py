from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.autoservice_caldav import sync_all, sync_org

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
