from __future__ import annotations

import asyncio
import logging

from sqlalchemy.orm import Session

from app.services.new_parts_seo_sync_service import (
    SyncResult,
    append_created_cards_to_new_parts_sitemap,
    sync_new_parts_seo_batch,
)
from app.utils.yandex_integration_db import get_or_create_yandex_integration

logger = logging.getLogger(__name__)


async def execute_seo_sync_batch_job(db: Session) -> SyncResult:
    integration = get_or_create_yandex_integration(db)
    host_url = integration.host_url
    sync_stats = await sync_new_parts_seo_batch(db)
    if sync_stats.created_card_ids:
        appended = append_created_cards_to_new_parts_sitemap(
            db,
            sync_stats.created_card_ids,
            preferred_host_url=host_url,
        )
        logger.info(
            "New parts SEO sitemap incremental append: cards=%s appended=%s",
            len(sync_stats.created_card_ids),
            appended,
        )
    try:
        from app.services.seo_rossko_seed_service import maybe_run_precheck_boost

        boost_stats = await maybe_run_precheck_boost(db)
        if boost_stats:
            logger.info("Rossko SEO precheck boost: %s", boost_stats)
    except Exception:
        logger.exception("Rossko SEO precheck boost failed")
    return sync_stats


def run_seo_sync_batch_sync() -> dict[str, object]:
    from app.db.database import SessionLocal

    db = SessionLocal()
    try:
        sync_stats = asyncio.run(execute_seo_sync_batch_job(db))
        return {
            "ok": True,
            "created": sync_stats.created,
            "processed": sync_stats.processed,
            "stopped_by_daily_limit": sync_stats.stopped_by_daily_limit,
            "stopped_by_batch_limit": sync_stats.stopped_by_batch_limit,
            "remaining_daily_quota": sync_stats.remaining_daily_quota,
        }
    finally:
        db.close()
