from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.autoservice_notifications import run_daily_planner_digests

logger = logging.getLogger(__name__)


@celery_app.task(name="autoservice.send_daily_planner_digest")
def send_daily_planner_digest() -> dict:
    db = SessionLocal()
    try:
        result = run_daily_planner_digests(db)
        logger.info("Autoservice daily planner digest finished: %s", result)
        return result
    finally:
        db.close()
