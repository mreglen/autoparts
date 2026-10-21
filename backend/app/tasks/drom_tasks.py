from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.drom_price_list import reconcile_all_drom_price_lists, reconcile_drom_price_list

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


@celery_app.task(name="drom.reconcile_price_list")
def reconcile_drom_price_list_task(org_id: str) -> dict:
    db = SessionLocal()
    try:
        result = reconcile_drom_price_list(db, org_id)
        logger.info("Drom price list reconciled for org %s: %s", org_id, result)
        return result
    finally:
        db.close()
