from __future__ import annotations

import logging

from app.celery_app import celery_app
from app.services.new_parts_seo_batch_runner import run_seo_sync_batch_sync

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=1, name="seo.run_new_parts_sync_batch")
def run_new_parts_seo_sync_batch_task(self):
    try:
        result = run_seo_sync_batch_sync()
        logger.info("Celery SEO sync batch finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery SEO sync batch failed")
        raise self.retry(exc=exc, countdown=60)
