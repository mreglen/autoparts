"""Access to the process-wide APScheduler instance for SEO job reschedule."""
from __future__ import annotations

import logging
from typing import Any

from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler: Any = None

SEO_SYNC_JOB_ID = "new_parts_seo_sync_batch"
SEO_PRECHECK_JOB_ID = "seo_rossko_seed_precheck"


def set_apscheduler(scheduler) -> None:
    global _scheduler
    _scheduler = scheduler


def get_apscheduler():
    return _scheduler


def reschedule_seo_jobs(
    *,
    batch_interval_minutes: int,
    precheck_interval_minutes: int,
) -> dict[str, bool]:
    """Reschedule SEO sync/precheck intervals. No-op if this process is not the scheduler leader."""
    scheduler = get_apscheduler()
    result = {"sync": False, "precheck": False, "scheduler_available": False}
    if scheduler is None:
        logger.info("SEO reschedule skipped: scheduler not available on this worker")
        return result

    result["scheduler_available"] = True
    sync_minutes = max(1, int(batch_interval_minutes))
    precheck_minutes = max(1, int(precheck_interval_minutes))

    try:
        if scheduler.get_job(SEO_SYNC_JOB_ID):
            scheduler.reschedule_job(
                SEO_SYNC_JOB_ID,
                trigger=IntervalTrigger(minutes=sync_minutes),
            )
            result["sync"] = True
        if scheduler.get_job(SEO_PRECHECK_JOB_ID):
            scheduler.reschedule_job(
                SEO_PRECHECK_JOB_ID,
                trigger=IntervalTrigger(minutes=precheck_minutes),
            )
            result["precheck"] = True
        logger.info(
            "SEO jobs rescheduled: sync=%sm precheck=%sm result=%s",
            sync_minutes,
            precheck_minutes,
            result,
        )
    except Exception:
        logger.exception("Failed to reschedule SEO jobs")
    return result
