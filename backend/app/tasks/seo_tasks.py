from __future__ import annotations

import asyncio
import logging

from app.celery_app import celery_app
from app.services.new_parts_seo_batch_runner import run_seo_sync_batch_sync

logger = logging.getLogger(__name__)


def _run_with_session(async_fn):
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        return asyncio.run(async_fn(db))
    finally:
        db.close()


def _run_with_session_sync(sync_fn):
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        return sync_fn(db)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=1, name="seo.run_new_parts_sync_batch")
def run_new_parts_seo_sync_batch_task(self):
    try:
        result = run_seo_sync_batch_sync()
        logger.info("Celery SEO sync batch finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery SEO sync batch failed")
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, max_retries=1, name="seo.rebuild_sitemaps_cache")
def rebuild_sitemaps_cache_task(self):
    try:
        from app.services.sitemap_service import rebuild_all_sitemaps_cache
        from app.utils.yandex_integration_db import get_or_create_yandex_integration

        def _rebuild(db):
            integration = get_or_create_yandex_integration(db)
            products_snapshot, new_parts_snapshot, new_brands_snapshot, new_categories_snapshot = (
                rebuild_all_sitemaps_cache(db, preferred_host_url=integration.host_url)
            )
            return {
                "ok": True,
                "products_url_count": products_snapshot.url_count,
                "new_parts_url_count": new_parts_snapshot.url_count,
                "new_brands_url_count": new_brands_snapshot.url_count,
                "new_categories_url_count": new_categories_snapshot.url_count,
            }

        result = _run_with_session_sync(_rebuild)
        logger.info("Celery sitemap rebuild finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery sitemap rebuild failed")
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(bind=True, max_retries=1, name="seo.refresh_new_parts_cards")
def refresh_new_parts_seo_cards_task(self):
    try:
        from app.services.new_parts_seo_refresh_service import refresh_new_parts_seo_cards

        refresh_stats = _run_with_session(refresh_new_parts_seo_cards)
        result = {
            "ok": True,
            "candidates": refresh_stats.candidates,
            "updated": refresh_stats.updated,
            "not_found": refresh_stats.not_found,
            "errors": refresh_stats.errors,
        }
        logger.info("Celery SEO refresh finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery SEO refresh failed")
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(bind=True, max_retries=1, name="seo.seed_precheck_batch")
def seed_precheck_batch_task(self):
    try:
        from app.services.seo_rossko_seed_service import run_seed_precheck_batch

        stats = _run_with_session(run_seed_precheck_batch)
        result = {"ok": True, **stats}
        logger.info("Celery SEO seed precheck finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery SEO seed precheck failed")
        raise self.retry(exc=exc, countdown=120)


@celery_app.task(bind=True, max_retries=1, name="seo.tecdoc_harvest")
def tecdoc_harvest_task(self):
    try:
        from app.services.tecdoc_pair_harvest_service import (
            harvest_tecdoc_cross_pairs,
            harvest_tecdoc_direct_pairs,
        )

        def _harvest(db):
            direct_stats = harvest_tecdoc_direct_pairs(db)
            cross_stats = harvest_tecdoc_cross_pairs(db)
            return {"ok": True, "direct": direct_stats, "cross": cross_stats}

        result = _run_with_session_sync(_harvest)
        logger.info("Celery TecDoc harvest finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery TecDoc harvest failed")
        raise self.retry(exc=exc, countdown=300)


@celery_app.task(bind=True, max_retries=1, name="seo.seed_populate")
def seed_populate_task(self):
    try:
        from app.services.seo_rossko_seed_service import populate_seed_queue_from_catalog

        stats = _run_with_session_sync(populate_seed_queue_from_catalog)
        result = {"ok": True, **stats}
        logger.info("Celery SEO seed populate finished: %s", result)
        return result
    except Exception as exc:
        logger.exception("Celery SEO seed populate failed")
        raise self.retry(exc=exc, countdown=300)
