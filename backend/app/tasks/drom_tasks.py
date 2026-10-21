from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.drom_price_list import reconcile_all_drom_price_lists

logger = logging.getLogger(__name__)


@celery_app.task(name="drom.reconcile_price_lists")
def reconcile_drom_price_lists_task() -> dict:
    db = SessionLocal()
    try:
        result = reconcile_all_drom_price_lists(db)
        logger.info("Drom price lists reconciled: %s", {k: v for k, v in result.items() if k != "details"})
        return result
    finally:
        db.close()
