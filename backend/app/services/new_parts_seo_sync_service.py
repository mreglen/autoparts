from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.new_parts_seo_sync_log import NewPartsSeoSyncLog
from app.models.product import Product
from app.schemas.rossko import SearchRequest
from app.services.new_parts_seo_card_service import (
    ROSSKO_NEW_PART_SOURCE,
    _stable_key,
    create_or_get_new_part_card,
    is_rossko_new_part_sitemap_eligible,
)
from app.services.rossko_part_selection import pick_best_rossko_part, rossko_part_to_card_payload
from app.services.sitemap_service import is_working_catalog_product
from app.services.yandex_feed_xml_service import _iter_catalog_products
from app.utils.partnumber import build_product_lookup_key, normalize_partnumber

logger = logging.getLogger(__name__)

STATUS_CREATED = "created"
STATUS_UPDATED_EXISTING = "updated_existing"
STATUS_SKIPPED_EXISTS = "skipped_exists"
STATUS_NOT_FOUND = "not_found"
STATUS_ERROR = "error"


@dataclass
class ProductLookupCandidate:
    lookup_key: str
    brand: str
    article: str


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


def collect_distinct_product_candidates(db: Session) -> list[ProductLookupCandidate]:
    seen: set[str] = set()
    candidates: list[ProductLookupCandidate] = []

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
            ProductLookupCandidate(
                lookup_key=lookup_key,
                brand=brand,
                article=article,
            )
        )
    return candidates


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


def _candidate_sort_key(db: Session, candidate: ProductLookupCandidate) -> tuple[int, datetime]:
    log_row = _get_sync_log(db, candidate.lookup_key)
    if log_row is None:
        return (0, datetime.min.replace(tzinfo=timezone.utc))
    if log_row.status == STATUS_NOT_FOUND:
        return (1, log_row.next_retry_at or datetime.min.replace(tzinfo=timezone.utc))
    return (2, log_row.checked_at or datetime.min.replace(tzinfo=timezone.utc))


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
    candidate: ProductLookupCandidate,
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


async def sync_new_parts_seo_from_products(
    db: Session,
    *,
    daily_limit: int | None = None,
    rossko_delay_sec: float | None = None,
    not_found_retry_days: int | None = None,
) -> SyncResult:
    limit = daily_limit if daily_limit is not None else settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT
    delay = rossko_delay_sec if rossko_delay_sec is not None else settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC
    retry_days = (
        not_found_retry_days
        if not_found_retry_days is not None
        else settings.NEW_PARTS_SEO_SYNC_NOT_FOUND_RETRY_DAYS
    )

    result = SyncResult()
    now = _utcnow()
    already_created_today = count_seo_cards_created_today(db)
    remaining_new = max(0, limit - already_created_today)

    candidates = collect_distinct_product_candidates(db)
    result.candidates = len(candidates)
    candidates.sort(key=lambda c: _candidate_sort_key(db, c))

    session_seen_lookup: set[str] = set()
    session_seen_stable: set[str] = set()

    for candidate in candidates:
        if remaining_new <= 0:
            result.stopped_by_daily_limit = True
            break

        if candidate.lookup_key in session_seen_lookup:
            result.skipped += 1
            continue
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
            continue

        log_row = _get_sync_log(db, candidate.lookup_key)
        if _should_skip_before_rossko(log_row, now):
            result.skipped += 1
            continue

        result.processed += 1
        try:
            search_text = f"{candidate.brand} {candidate.article}".strip()
            rossko_data = await _fetch_rossko_search(db, search_text)
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
                continue

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
                continue
            session_seen_stable.add(stable_key)

            is_new_card = not stable_key_exists(db, rossko_brand, rossko_article)
            if is_new_card and remaining_new <= 0:
                result.stopped_by_daily_limit = True
                break

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

    return result
