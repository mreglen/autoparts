from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.services.search_subscription_service import notify_subscribers_for_product

logger = logging.getLogger(__name__)


@celery_app.task(name="check_product_search_subscriptions")
def check_product_search_subscriptions(product_id: int) -> int:
    db = SessionLocal()
    try:
        count = notify_subscribers_for_product(db, product_id)
        logger.info("Search subscription notifications sent: %s for product %s", count, product_id)
        return count
    finally:
        db.close()
