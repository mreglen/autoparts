from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.analytics_query_review_service import run_query_review

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=1, name="analytics.run_monthly_query_review")
def run_monthly_query_review_task(self):
    db = SessionLocal()
    try:
        result = run_query_review(db, days=28, limit=50)
        logger.info(
            "Monthly query review finished: snapshot_id=%s status=%s items=%s",
            result.id,
            result.status,
            len(result.items),
        )
        return {"snapshot_id": result.id, "status": result.status, "items": len(result.items)}
    except Exception as exc:
        logger.exception("Monthly query review failed")
        raise self.retry(exc=exc, countdown=300) from exc
    finally:
        db.close()
