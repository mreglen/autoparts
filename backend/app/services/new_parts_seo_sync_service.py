from __future__ import annotations

import asyncio
import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.new_parts_seo_sync_log import NewPartsSeoSyncLog
from app.models.product import Product
from app.models.garage_new_orders import GarageNewOrderItem
from app.schemas.rossko import SearchRequest
from app.services.new_parts_seo_card_service import (
    ROSSKO_NEW_PART_SOURCE,
    _stable_key,
    create_or_get_new_part_card,
    is_rossko_new_part_sitemap_eligible,
)
from app.services.rossko_part_selection import pick_best_rossko_part, rossko_part_to_card_payload
from app.services.sitemap_service import append_new_part_card_to_sitemap_cache, is_working_catalog_product
from app.services.yandex_feed_xml_service import _iter_catalog_products
from app.utils.partnumber import build_product_lookup_key, normalize_partnumber

logger = logging.getLogger(__name__)

STATUS_CREATED = "created"
STATUS_UPDATED_EXISTING = "updated_existing"
STATUS_SKIPPED_EXISTS = "skipped_exists"
STATUS_NOT_FOUND = "not_found"
STATUS_ERROR = "error"

SOURCE_ORDER = "order"
SOURCE_PRODUCT = "product"
SOURCE_CROSS = "cross"
SOURCE_PRIORITY = {SOURCE_ORDER: 0, SOURCE_PRODUCT: 1, SOURCE_CROSS: 2}
MAX_CROSSES_PER_ROSSKO_RESPONSE = 12


@dataclass
class SyncCandidate:
    lookup_key: str
    brand: str
    article: str
    source: str = SOURCE_PRODUCT


@dataclass
class SyncResult:
    candidates: int = 0
    processed: int = 0
    created: int = 0
    updated_existing: int = 0
    skipped: int = 0
    not_found: int = 0
    errors: int = 0
    stopped_by_daily_limit: bool = False
    stopped_by_batch_limit: bool = False
    batch_size: int = 0
    remaining_daily_quota: int = 0
    created_card_ids: list[int] = field(default_factory=list)
    details: list[str] = field(default_factory=list)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _today_start_utc() -> datetime:
    now = _utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def count_seo_cards_created_today(db: Session) -> int:
    today_start = _today_start_utc()
    return (
        db.query(NewPartsSeoSyncLog)
        .filter(
            NewPartsSeoSyncLog.status == STATUS_CREATED,
            NewPartsSeoSyncLog.checked_at >= today_start,
        )
        .count()
    )


def get_seo_sync_batch_size(*, daily_limit: int | None = None) -> int:
    configured = int(settings.NEW_PARTS_SEO_SYNC_BATCH_SIZE or 0)
    if configured > 0:
        return configured
    interval_minutes = max(1, int(settings.NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES or 30))
    ticks_per_day = max(1, (24 * 60) // interval_minutes)
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    return max(1, math.ceil(limit / ticks_per_day))


def get_seo_sync_runtime_settings() -> dict[str, object]:
    daily_limit = int(settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT)
    interval_minutes = max(1, int(settings.NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES or 30))
    return {
        "daily_limit": daily_limit,
        "rossko_delay_sec": float(settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC),
        "sitemap_daily_url_limit": int(settings.SEO_SITEMAP_DAILY_URL_LIMIT),
        "refresh_batch_size": int(settings.NEW_PARTS_SEO_REFRESH_BATCH_SIZE),
        "batch_interval_minutes": interval_minutes,
        "batch_size": get_seo_sync_batch_size(daily_limit=daily_limit),
        "batch_size_configured": int(settings.NEW_PARTS_SEO_SYNC_BATCH_SIZE or 0),
        "use_celery": bool(settings.NEW_PARTS_SEO_SYNC_USE_CELERY),
        "micro_batch_enabled": True,
    }


def collect_distinct_product_candidates(db: Session) -> list[SyncCandidate]:
    seen: set[str] = set()
    candidates: list[SyncCandidate] = []

    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        brand = (product.brand or "").strip()
        article = (product.article or "").strip()
        lookup_key = build_product_lookup_key(brand, article)
        if not lookup_key or lookup_key in seen:
            continue
        seen.add(lookup_key)
        candidates.append(
            SyncCandidate(
                lookup_key=lookup_key,
                brand=brand,
                article=article,
                source=SOURCE_PRODUCT,
            )
        )
    return candidates


def collect_order_item_candidates(db: Session) -> list[SyncCandidate]:
    seen: set[str] = set()
    candidates: list[SyncCandidate] = []

    rows = (
        db.query(GarageNewOrderItem.brand, GarageNewOrderItem.partnumber)
        .filter(
            GarageNewOrderItem.brand.isnot(None),
            GarageNewOrderItem.partnumber.isnot(None),
        )
        .distinct()
        .all()
    )
    for brand_raw, article_raw in rows:
        brand = (brand_raw or "").strip()
        article = (article_raw or "").strip()
        lookup_key = build_product_lookup_key(brand, article)
        if not lookup_key or lookup_key in seen:
            continue
        seen.add(lookup_key)
        candidates.append(
            SyncCandidate(
                lookup_key=lookup_key,
                brand=brand,
                article=article,
                source=SOURCE_ORDER,
            )
        )
    return candidates


def collect_all_sync_candidates(db: Session) -> list[SyncCandidate]:
    seen: set[str] = set()
    merged: list[SyncCandidate] = []
    for collector in (collect_order_item_candidates, collect_distinct_product_candidates):
        for candidate in collector(db):
            if candidate.lookup_key in seen:
                continue
            seen.add(candidate.lookup_key)
            merged.append(candidate)
    return merged


def extract_cross_candidates_from_rossko(
    rossko_data: dict,
    *,
    max_crosses: int = MAX_CROSSES_PER_ROSSKO_RESPONSE,
) -> list[SyncCandidate]:
    results: list[SyncCandidate] = []
    seen: set[str] = set()

    def add_cross(brand: str, article: str) -> None:
        if len(results) >= max_crosses:
            return
        lookup_key = build_product_lookup_key(brand, article)
        if not lookup_key or lookup_key in seen:
            return
        seen.add(lookup_key)
        results.append(
            SyncCandidate(
                lookup_key=lookup_key,
                brand=brand,
                article=article,
                source=SOURCE_CROSS,
            )
        )

    def walk_cross_parts(parts) -> None:
        if not parts:
            return
        if not isinstance(parts, list):
            parts = [parts]
        for part in parts:
            if not isinstance(part, dict):
                continue
            brand = (part.get("brand") or "").strip()
            article = (part.get("partnumber") or "").strip()
            if brand and article:
                add_cross(brand, article)
            if len(results) >= max_crosses:
                return

    parts_list = (rossko_data.get("PartsList") or {}).get("Part")
    if not parts_list:
        return results
    if not isinstance(parts_list, list):
        parts_list = [parts_list]

    for part in parts_list:
        if not isinstance(part, dict):
            continue
        crosses = part.get("crosses") or {}
        cross_parts = crosses.get("Part") or []
        if not isinstance(cross_parts, list):
            cross_parts = [cross_parts] if cross_parts else []
        walk_cross_parts(cross_parts)
        if len(results) >= max_crosses:
            break
    return results


def find_active_card_for_lookup(db: Session, brand: str, article: str) -> NewPartsSeoCard | None:
    target_article = normalize_partnumber(article)
    brand_cf = brand.strip().casefold()
    if not target_article or not brand_cf:
        return None

    rows = (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.brand) == brand_cf,
        )
        .all()
    )
    for row in rows:
        if normalize_partnumber(row.article) == target_article:
            return row
    return None


def stable_key_exists(db: Session, brand: str, article: str) -> bool:
    key = _stable_key(ROSSKO_NEW_PART_SOURCE, brand, article)
    return db.query(NewPartsSeoCard.id).filter(NewPartsSeoCard.stable_key == key).first() is not None


def _get_sync_log(db: Session, lookup_key: str) -> NewPartsSeoSyncLog | None:
    return (
        db.query(NewPartsSeoSyncLog)
        .filter(NewPartsSeoSyncLog.lookup_key == lookup_key)
        .first()
    )


def _should_skip_before_rossko(log_row: NewPartsSeoSyncLog | None, now: datetime) -> bool:
    if log_row is None:
        return False
    if log_row.status in {STATUS_CREATED, STATUS_SKIPPED_EXISTS, STATUS_UPDATED_EXISTING}:
        return True
    if log_row.status == STATUS_NOT_FOUND and log_row.next_retry_at and log_row.next_retry_at > now:
        return True
    return False


def _candidate_sort_key(db: Session, candidate: SyncCandidate) -> tuple[int, int, datetime]:
    source_prio = SOURCE_PRIORITY.get(candidate.source, 9)
    log_row = _get_sync_log(db, candidate.lookup_key)
    if log_row is None:
        return (source_prio, 0, datetime.min.replace(tzinfo=timezone.utc))
    if log_row.status == STATUS_NOT_FOUND:
        return (source_prio, 1, log_row.next_retry_at or datetime.min.replace(tzinfo=timezone.utc))
    return (source_prio, 2, log_row.checked_at or datetime.min.replace(tzinfo=timezone.utc))


async def _fetch_rossko_search(db: Session, search_text: str) -> dict:
    from app.routers.rossko_api.rossko_api import (
        rossko_address_id,
        rossko_delivery_id,
        rossko_search,
    )

    return await rossko_search(
        SearchRequest(
            text=search_text,
            delivery_id=rossko_delivery_id,
            address_id=rossko_address_id,
        ),
        db,
    )


def _upsert_sync_log(
    db: Session,
    *,
    candidate: SyncCandidate,
    status: str,
    rossko_brand: str | None = None,
    rossko_article: str | None = None,
    seo_card_id: int | None = None,
    error_message: str | None = None,
    next_retry_at: datetime | None = None,
) -> None:
    now = _utcnow()
    row = _get_sync_log(db, candidate.lookup_key)
    if row is None:
        row = NewPartsSeoSyncLog(
            lookup_key=candidate.lookup_key,
            lookup_brand=candidate.brand,
            lookup_article=candidate.article,
        )
        db.add(row)
    row.lookup_brand = candidate.brand
    row.lookup_article = candidate.article
    row.rossko_brand = rossko_brand
    row.rossko_article = rossko_article
    row.seo_card_id = seo_card_id
    row.status = status
    row.error_message = error_message
    row.checked_at = now
    row.next_retry_at = next_retry_at
    db.commit()


async def _process_sync_candidate(
    db: Session,
    candidate: SyncCandidate,
    *,
    now: datetime,
    retry_days: int,
    delay: float,
    session_seen_lookup: set[str],
    session_seen_stable: set[str],
    remaining_new: int,
    pending_crosses: list[SyncCandidate],
    result: SyncResult,
) -> int:
    if candidate.lookup_key in session_seen_lookup:
        result.skipped += 1
        return remaining_new
    session_seen_lookup.add(candidate.lookup_key)

    existing_card = find_active_card_for_lookup(db, candidate.brand, candidate.article)
    if existing_card is not None:
        _upsert_sync_log(
            db,
            candidate=candidate,
            status=STATUS_SKIPPED_EXISTS,
            rossko_brand=existing_card.brand,
            rossko_article=existing_card.article,
            seo_card_id=existing_card.id,
        )
        result.skipped += 1
        return remaining_new

    log_row = _get_sync_log(db, candidate.lookup_key)
    if _should_skip_before_rossko(log_row, now):
        result.skipped += 1
        return remaining_new

    result.processed += 1
    try:
        search_text = f"{candidate.brand} {candidate.article}".strip()
        rossko_data = await _fetch_rossko_search(db, search_text)
        for cross_candidate in extract_cross_candidates_from_rossko(rossko_data):
            if cross_candidate.lookup_key not in session_seen_lookup:
                pending_crosses.append(cross_candidate)

        best_part = pick_best_rossko_part(
            rossko_data,
            brand=candidate.brand,
            article=candidate.article,
        )
        if best_part is None:
            _upsert_sync_log(
                db,
                candidate=candidate,
                status=STATUS_NOT_FOUND,
                next_retry_at=now + timedelta(days=retry_days),
            )
            result.not_found += 1
            if delay > 0:
                await asyncio.sleep(delay)
            return remaining_new

        payload = rossko_part_to_card_payload(best_part)
        rossko_brand = payload.get("brand") or candidate.brand
        rossko_article = payload.get("article") or candidate.article
        stable_key = _stable_key(ROSSKO_NEW_PART_SOURCE, rossko_brand, rossko_article)

        if stable_key in session_seen_stable:
            _upsert_sync_log(
                db,
                candidate=candidate,
                status=STATUS_SKIPPED_EXISTS,
                rossko_brand=rossko_brand,
                rossko_article=rossko_article,
            )
            result.skipped += 1
            if delay > 0:
                await asyncio.sleep(delay)
            return remaining_new
        session_seen_stable.add(stable_key)

        is_new_card = not stable_key_exists(db, rossko_brand, rossko_article)
        if is_new_card and remaining_new <= 0:
            result.stopped_by_daily_limit = True
            return remaining_new

        card = create_or_get_new_part_card(db, payload)
        if not is_rossko_new_part_sitemap_eligible(card):
            _upsert_sync_log(
                db,
                candidate=candidate,
                status=STATUS_NOT_FOUND,
                rossko_brand=rossko_brand,
                rossko_article=rossko_article,
                seo_card_id=card.id,
                next_retry_at=now + timedelta(days=retry_days),
            )
            result.not_found += 1
        elif is_new_card:
            _upsert_sync_log(
                db,
                candidate=candidate,
                status=STATUS_CREATED,
                rossko_brand=card.brand,
                rossko_article=card.article,
                seo_card_id=card.id,
            )
            result.created += 1
            result.created_card_ids.append(card.id)
            remaining_new -= 1
        else:
            _upsert_sync_log(
                db,
                candidate=candidate,
                status=STATUS_UPDATED_EXISTING,
                rossko_brand=card.brand,
                rossko_article=card.article,
                seo_card_id=card.id,
            )
            result.updated_existing += 1

    except Exception as exc:
        logger.exception(
            "SEO sync failed for lookup_key=%s brand=%s article=%s",
            candidate.lookup_key,
            candidate.brand,
            candidate.article,
        )
        _upsert_sync_log(
            db,
            candidate=candidate,
            status=STATUS_ERROR,
            error_message=str(exc)[:500],
            next_retry_at=now + timedelta(days=1),
        )
        result.errors += 1

    if delay > 0:
        await asyncio.sleep(delay)
    return remaining_new


async def _run_seo_sync(
    db: Session,
    *,
    max_new_cards: int,
    rossko_delay_sec: float | None = None,
    not_found_retry_days: int | None = None,
    batch_size: int = 0,
    remaining_daily_quota: int = 0,
) -> SyncResult:
    delay = rossko_delay_sec if rossko_delay_sec is not None else settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC
    retry_days = (
        not_found_retry_days
        if not_found_retry_days is not None
        else settings.NEW_PARTS_SEO_SYNC_NOT_FOUND_RETRY_DAYS
    )

    result = SyncResult(
        batch_size=batch_size,
        remaining_daily_quota=remaining_daily_quota,
    )
    now = _utcnow()
    remaining_new = max(0, max_new_cards)

    if remaining_new <= 0:
        result.stopped_by_daily_limit = True
        return result

    candidates = collect_all_sync_candidates(db)
    result.candidates = len(candidates)
    candidates.sort(key=lambda c: _candidate_sort_key(db, c))

    session_seen_lookup: set[str] = set()
    session_seen_stable: set[str] = set()
    pending_crosses: list[SyncCandidate] = []

    for candidate in candidates:
        if remaining_new <= 0:
            if batch_size > 0:
                result.stopped_by_batch_limit = True
            else:
                result.stopped_by_daily_limit = True
            break
        remaining_new = await _process_sync_candidate(
            db,
            candidate,
            now=now,
            retry_days=retry_days,
            delay=delay,
            session_seen_lookup=session_seen_lookup,
            session_seen_stable=session_seen_stable,
            remaining_new=remaining_new,
            pending_crosses=pending_crosses,
            result=result,
        )
        if result.stopped_by_daily_limit:
            break

    if remaining_new > 0 and pending_crosses:
        pending_crosses.sort(key=lambda c: _candidate_sort_key(db, c))
        for candidate in pending_crosses:
            if remaining_new <= 0:
                if batch_size > 0:
                    result.stopped_by_batch_limit = True
                else:
                    result.stopped_by_daily_limit = True
                break
            remaining_new = await _process_sync_candidate(
                db,
                candidate,
                now=now,
                retry_days=retry_days,
                delay=delay,
                session_seen_lookup=session_seen_lookup,
                session_seen_stable=session_seen_stable,
                remaining_new=remaining_new,
                pending_crosses=pending_crosses,
                result=result,
            )
            if result.stopped_by_daily_limit:
                break

    if batch_size > 0 and remaining_new <= 0:
        result.stopped_by_batch_limit = True

    return result


async def sync_new_parts_seo_batch(
    db: Session,
    *,
    max_new_cards: int | None = None,
    daily_limit: int | None = None,
    rossko_delay_sec: float | None = None,
    not_found_retry_days: int | None = None,
) -> SyncResult:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    already_created_today = count_seo_cards_created_today(db)
    remaining_daily = max(0, limit - already_created_today)
    batch_size = max_new_cards if max_new_cards is not None else get_seo_sync_batch_size(daily_limit=limit)
    target_new = min(remaining_daily, max(1, batch_size))

    return await _run_seo_sync(
        db,
        max_new_cards=target_new,
        rossko_delay_sec=rossko_delay_sec,
        not_found_retry_days=not_found_retry_days,
        batch_size=batch_size,
        remaining_daily_quota=remaining_daily,
    )


async def sync_new_parts_seo_from_products(
    db: Session,
    *,
    daily_limit: int | None = None,
    rossko_delay_sec: float | None = None,
    not_found_retry_days: int | None = None,
) -> SyncResult:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    already_created_today = count_seo_cards_created_today(db)
    remaining_daily = max(0, limit - already_created_today)

    return await _run_seo_sync(
        db,
        max_new_cards=remaining_daily,
        rossko_delay_sec=rossko_delay_sec,
        not_found_retry_days=not_found_retry_days,
        batch_size=0,
        remaining_daily_quota=remaining_daily,
    )


def append_created_cards_to_new_parts_sitemap(
    db: Session,
    card_ids: list[int],
    *,
    preferred_host_url: str | None = None,
) -> int:
    if not card_ids:
        return 0
    appended = 0
    rows = (
        db.query(NewPartsSeoCard)
        .filter(NewPartsSeoCard.id.in_(card_ids))
        .all()
    )
    by_id = {row.id: row for row in rows}
    for card_id in card_ids:
        card = by_id.get(card_id)
        if card and append_new_part_card_to_sitemap_cache(
            db,
            card,
            preferred_host_url=preferred_host_url,
        ):
            appended += 1
    return appended


def count_active_rossko_seo_cards(db: Session) -> int:
    return (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
        )
        .count()
    )


def count_eligible_rossko_seo_cards(db: Session) -> int:
    return sum(
        1
        for card in db.query(NewPartsSeoCard).filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
        )
        if is_rossko_new_part_sitemap_eligible(card)
    )


def get_cards_created_by_day(db: Session, *, days: int = 14) -> list[dict[str, object]]:
    safe_days = max(1, min(int(days or 14), 90))
    since = _utcnow() - timedelta(days=safe_days - 1)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = (
        db.query(
            func.date(NewPartsSeoSyncLog.checked_at).label("day"),
            func.count(NewPartsSeoSyncLog.id).label("created"),
        )
        .filter(
            NewPartsSeoSyncLog.status == STATUS_CREATED,
            NewPartsSeoSyncLog.checked_at >= since,
        )
        .group_by(func.date(NewPartsSeoSyncLog.checked_at))
        .order_by(func.date(NewPartsSeoSyncLog.checked_at).asc())
        .all()
    )
    return [{"day": str(row.day), "created": int(row.created or 0)} for row in rows]


def get_new_parts_seo_dashboard_stats(db: Session, *, days: int = 14) -> dict[str, object]:
    total = count_active_rossko_seo_cards(db)
    eligible = count_eligible_rossko_seo_cards(db)
    created_today = count_seo_cards_created_today(db)
    eligible_pct = round((eligible / total) * 100, 1) if total else 0.0
    return {
        "cards_total": total,
        "cards_eligible": eligible,
        "cards_eligible_pct": eligible_pct,
        "cards_created_today": created_today,
        "created_by_day": get_cards_created_by_day(db, days=days),
        "settings": get_seo_sync_runtime_settings(),
    }
