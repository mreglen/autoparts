from __future__ import annotations

import json
import math
from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.seo_rossko_seed_queue import SeoRosskoSeedQueue
from app.models.seo_sync_daily_counter import SeoSyncDailyCounter
from app.services.seo_sync_pending_service import count_pending_candidates

SOURCE_DAILY_SHARES: dict[str, float] = {
    "tecdoc": 0.35,
    "product": 0.25,
    "order": 0.15,
    "semantic": 0.10,
    "landing": 0.05,
    "card_cross": 0.05,
    "cross": 0.05,
    "sibling": 0.0,
    "unknown": 0.0,
}


def get_source_daily_shares() -> dict[str, float]:
    return dict(SOURCE_DAILY_SHARES)


def _load_created_by_source(row: SeoSyncDailyCounter | None) -> dict[str, int]:
    if row is None or not row.created_by_source_json:
        return {}
    try:
        data = json.loads(row.created_by_source_json)
    except (json.JSONDecodeError, TypeError):
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(key): int(value or 0) for key, value in data.items()}


def count_cards_created_today_by_source(db: Session) -> dict[str, int]:
    row = (
        db.query(SeoSyncDailyCounter)
        .filter(SeoSyncDailyCounter.stat_date == _today_utc())
        .first()
    )
    return _load_created_by_source(row)


def increment_created_by_source(db: Session, source: str, *, amount: int = 1) -> dict[str, int]:
    key = (source or "unknown").strip() or "unknown"
    row = _get_or_create_daily_counter(db)
    counts = _load_created_by_source(row)
    counts[key] = int(counts.get(key, 0)) + max(1, amount)
    row.created_by_source_json = json.dumps(counts, ensure_ascii=False)
    db.commit()
    return counts


def source_quota_cap(source: str, *, daily_limit: int | None = None) -> int:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    share = get_source_daily_shares().get(source, 0.0)
    if share <= 0:
        return 0
    return max(1, int(math.floor(limit * share)))


def source_has_quota_remaining(
    db: Session,
    source: str,
    *,
    daily_limit: int | None = None,
) -> bool:
    cap = source_quota_cap(source, daily_limit=daily_limit)
    if cap <= 0:
        return False
    created = count_cards_created_today_by_source(db).get(source, 0)
    return created < cap


def _count_created_today(db: Session) -> int:
    from app.services.new_parts_seo_sync_service import count_seo_cards_created_today

    return count_seo_cards_created_today(db)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _today_utc() -> date:
    return _utcnow().date()


def get_expected_created_by_now(*, daily_limit: int | None = None) -> int:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    now = _utcnow()
    hour_fraction = now.hour / 24.0
    return int(math.floor(hour_fraction * limit))


def is_behind_quota(db: Session, *, daily_limit: int | None = None, slack: int | None = None) -> bool:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    slack_value = slack if slack is not None else settings.NEW_PARTS_SEO_CATCHUP_SLACK
    created = _count_created_today(db)
    expected = get_expected_created_by_now(daily_limit=limit)
    return created < expected - max(0, slack_value)


def _get_or_create_daily_counter(db: Session) -> SeoSyncDailyCounter:
    today = _today_utc()
    row = db.query(SeoSyncDailyCounter).filter(SeoSyncDailyCounter.stat_date == today).first()
    if row is None:
        row = SeoSyncDailyCounter(stat_date=today, cross_recurse_calls=0, precheck_calls=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def count_cross_recurse_calls_today(db: Session) -> int:
    row = (
        db.query(SeoSyncDailyCounter)
        .filter(SeoSyncDailyCounter.stat_date == _today_utc())
        .first()
    )
    return int(row.cross_recurse_calls or 0) if row else 0


def count_precheck_calls_today(db: Session) -> int:
    row = (
        db.query(SeoSyncDailyCounter)
        .filter(SeoSyncDailyCounter.stat_date == _today_utc())
        .first()
    )
    return int(row.precheck_calls or 0) if row else 0


def increment_cross_recurse_calls(db: Session, *, amount: int = 1) -> int:
    row = _get_or_create_daily_counter(db)
    row.cross_recurse_calls = int(row.cross_recurse_calls or 0) + max(1, amount)
    db.commit()
    return row.cross_recurse_calls


def increment_precheck_calls(db: Session, *, amount: int = 1) -> int:
    row = _get_or_create_daily_counter(db)
    row.precheck_calls = int(row.precheck_calls or 0) + max(1, amount)
    db.commit()
    return row.precheck_calls


def cross_recurse_budget_remaining(db: Session) -> int:
    limit = int(settings.NEW_PARTS_SEO_CROSS_RECURSE_DAILY or 0)
    if limit <= 0:
        return 0
    return max(0, limit - count_cross_recurse_calls_today(db))


def precheck_budget_remaining(db: Session) -> int:
    limit = int(settings.NEW_PARTS_SEO_SEED_PRECHECK_DAILY or 0)
    if limit <= 0:
        return 0
    return max(0, limit - count_precheck_calls_today(db))


def count_seed_queue_by_status(db: Session, status: str) -> int:
    return (
        db.query(SeoRosskoSeedQueue)
        .filter(SeoRosskoSeedQueue.status == status)
        .count()
    )


def count_seed_by_source(db: Session) -> dict[str, dict[str, int]]:
    rows = (
        db.query(
            SeoRosskoSeedQueue.source,
            SeoRosskoSeedQueue.status,
            func.count(SeoRosskoSeedQueue.lookup_key),
        )
        .group_by(SeoRosskoSeedQueue.source, SeoRosskoSeedQueue.status)
        .all()
    )
    result: dict[str, dict[str, int]] = {}
    for source, status, count in rows:
        bucket = result.setdefault(str(source or "unknown"), {"pending": 0, "ready": 0, "other": 0})
        if status in bucket:
            bucket[status] = int(count or 0)
        else:
            bucket["other"] = bucket.get("other", 0) + int(count or 0)
    return result


def get_seed_conversion_by_source(db: Session) -> dict[str, dict[str, object]]:
    """Precheck conversion: share of checked rows that reached ready (by source)."""
    rows = (
        db.query(
            SeoRosskoSeedQueue.source,
            SeoRosskoSeedQueue.status,
            func.count(SeoRosskoSeedQueue.lookup_key),
        )
        .group_by(SeoRosskoSeedQueue.source, SeoRosskoSeedQueue.status)
        .all()
    )
    by_source: dict[str, dict[str, int]] = {}
    for source, status, count in rows:
        bucket = by_source.setdefault(str(source or "unknown"), {})
        bucket[str(status or "unknown")] = int(count or 0)

    result: dict[str, dict[str, object]] = {}
    for source, counts in by_source.items():
        ready = int(counts.get("ready", 0))
        not_found = int(counts.get("not_found", 0))
        created = int(counts.get("created", 0))
        pending = int(counts.get("pending", 0))
        checked = ready + not_found + created
        conversion_pct = round(100.0 * ready / checked, 1) if checked > 0 else None
        result[source] = {
            "pending": pending,
            "ready": ready,
            "not_found": not_found,
            "created": created,
            "checked": checked,
            "conversion_pct": conversion_pct,
        }
    return result


def get_quota_status(db: Session, *, daily_limit: int | None = None) -> dict[str, object]:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    created_today = _count_created_today(db)
    expected = get_expected_created_by_now(daily_limit=limit)
    ready_count = count_seed_queue_by_status(db, "ready")
    pending_seed = count_seed_queue_by_status(db, "pending")
    deficit = max(0, limit - created_today)
    behind = is_behind_quota(db, daily_limit=limit)
    recurse_limit = int(settings.NEW_PARTS_SEO_CROSS_RECURSE_DAILY or 0)
    recurse_used = count_cross_recurse_calls_today(db)
    precheck_limit = int(settings.NEW_PARTS_SEO_SEED_PRECHECK_DAILY or 0)
    precheck_used = count_precheck_calls_today(db)
    guaranteed_ceiling = min(limit, ready_count + created_today) if ready_count else created_today
    pool_days_estimate = round(ready_count / limit, 1) if limit > 0 and ready_count else 0.0
    seed_by_source = count_seed_by_source(db)
    seed_conversion_by_source = get_seed_conversion_by_source(db)
    cards_created_today_by_source = count_cards_created_today_by_source(db)

    return {
        "daily_limit": limit,
        "created_today": created_today,
        "cards_created_today_by_source": cards_created_today_by_source,
        "source_daily_shares": get_source_daily_shares(),
        "expected_by_now": expected,
        "deficit": deficit,
        "behind_quota": behind,
        "pending_candidates": count_pending_candidates(db),
        "seed_pending": pending_seed,
        "seed_ready": ready_count,
        "guaranteed_ceiling": guaranteed_ceiling,
        "pool_days_estimate": pool_days_estimate,
        "seed_ready_target": int(settings.NEW_PARTS_SEO_SEED_READY_TARGET or 1500),
        "seed_by_source": seed_by_source,
        "seed_conversion_by_source": seed_conversion_by_source,
        "cross_recurse_used": recurse_used,
        "cross_recurse_limit": recurse_limit,
        "precheck_used": precheck_used,
        "precheck_limit": precheck_limit,
        "catchup_enabled": bool(settings.NEW_PARTS_SEO_CATCHUP_ENABLED),
        "catchup_slack": int(settings.NEW_PARTS_SEO_CATCHUP_SLACK or 0),
    }
