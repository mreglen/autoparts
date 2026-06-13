from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import engine
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.seo_landing_page import SeoLandingPage
from app.models.seo_rossko_seed_queue import SeoRosskoSeedQueue
from app.models.tecdoc import TecdocArticleCrossList, TecdocSupplier
from app.schemas.rossko import SearchRequest
from app.services.new_parts_seo_card_service import (
    ROSSKO_NEW_PART_SOURCE,
    _stable_key,
    list_new_part_cards_by_category_slug,
)
from app.services.rossko_part_selection import get_rossko_stock_count
from app.services.seo_quota_service import (
    count_seed_queue_by_status,
    increment_precheck_calls,
    precheck_budget_remaining,
)
from app.services.seo_semantic_seed_service import load_semantic_seed_pairs
from app.services.seo_tecdoc_brand_service import map_tecdoc_brand_to_rossko
from app.services.seo_sync_types import SOURCE_SEED_READY, SyncCandidate
from app.services.sitemap_service import is_working_catalog_product
from app.services.yandex_feed_xml_service import _iter_catalog_products
from app.utils.partnumber import build_product_lookup_key, normalize_partnumber

logger = logging.getLogger(__name__)

SOURCE_TECDOC = "tecdoc"
SOURCE_SEMANTIC = "semantic"
SOURCE_LANDING = "landing"
SOURCE_CARD_CROSS = "card_cross"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _upsert_seed_row(
    db: Session,
    *,
    lookup_key: str,
    brand: str,
    article: str,
    source: str,
    priority: int = 100,
) -> bool:
    if not lookup_key:
        return False
    existing_card = (
        db.query(NewPartsSeoCard.id)
        .filter(NewPartsSeoCard.stable_key == _stable_key(ROSSKO_NEW_PART_SOURCE, brand, article))
        .first()
    )
    if existing_card:
        return False
    existing = (
        db.query(SeoRosskoSeedQueue)
        .filter(SeoRosskoSeedQueue.lookup_key == lookup_key)
        .first()
    )
    if existing and existing.status in {"ready", "created"}:
        return False
    if existing:
        return False
    dialect = engine.dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        stmt = (
            pg_insert(SeoRosskoSeedQueue)
            .values(
                lookup_key=lookup_key,
                brand=brand,
                article=article,
                source=source,
                status="pending",
                priority=priority,
            )
            .on_conflict_do_nothing(index_elements=["lookup_key"])
        )
        result = db.execute(stmt)
        db.commit()
        return bool(result.rowcount)
    db.add(
        SeoRosskoSeedQueue(
            lookup_key=lookup_key,
            brand=brand,
            article=article,
            source=source,
            status="pending",
            priority=priority,
        )
    )
    db.commit()
    return True


def _try_add_pair(
    db: Session,
    *,
    brand: str,
    article: str,
    source: str,
    priority: int,
    seen: set[str],
    stats: dict[str, int],
    stat_key: str,
    total_limit: int,
) -> bool:
    if stats["total"] >= total_limit:
        return False
    lookup_key = build_product_lookup_key(brand, article)
    if not lookup_key or lookup_key in seen:
        return False
    seen.add(lookup_key)
    if _upsert_seed_row(
        db,
        lookup_key=lookup_key,
        brand=brand,
        article=article,
        source=source,
        priority=priority,
    ):
        stats[stat_key] = stats.get(stat_key, 0) + 1
        stats["total"] += 1
        return True
    return False


def enqueue_seed_candidates(db: Session, candidates: list[SyncCandidate]) -> int:
    inserted = 0
    for candidate in candidates:
        if _upsert_seed_row(
            db,
            lookup_key=candidate.lookup_key,
            brand=candidate.brand,
            article=candidate.article,
            source=candidate.source,
        ):
            inserted += 1
    return inserted


def _populate_semantic(db: Session, *, seen: set[str], stats: dict[str, int], limit: int) -> None:
    for brand, article in load_semantic_seed_pairs():
        _try_add_pair(
            db,
            brand=brand,
            article=article,
            source=SOURCE_SEMANTIC,
            priority=30,
            seen=seen,
            stats=stats,
            stat_key="semantic",
            total_limit=limit,
        )
        if stats["total"] >= limit:
            return


def _populate_tecdoc(
    db: Session,
    *,
    seen: set[str],
    stats: dict[str, int],
    total_limit: int,
    tecdoc_budget: int,
    loop_harvest: bool = False,
) -> None:
    from app.services.tecdoc_pair_harvest_service import (
        harvest_tecdoc_cross_pairs,
        harvest_tecdoc_direct_pairs,
    )

    stats.setdefault("tecdoc_scanned", 0)
    stats.setdefault("tecdoc_harvest_rounds", 0)

    normalized_articles: set[str] = set()
    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        article = (product.article or "").strip()
        norm = normalize_partnumber(article)
        if norm:
            normalized_articles.add(norm)
        if len(normalized_articles) >= 10000:
            break

    inserted_tecdoc = int(stats.get("tecdoc", 0))
    if normalized_articles:
        article_list = list(normalized_articles)
        try:
            for offset in range(0, len(article_list), 200):
                if inserted_tecdoc >= tecdoc_budget or stats["total"] >= total_limit:
                    break
                batch = article_list[offset : offset + 200]
                cross_rows = (
                    db.query(TecdocArticleCrossList.Article, TecdocSupplier.Description)
                    .join(
                        TecdocSupplier,
                        TecdocSupplier.id == TecdocArticleCrossList.supplier,
                    )
                    .filter(TecdocArticleCrossList.Article.in_(batch))
                    .limit(min(500, tecdoc_budget - inserted_tecdoc))
                    .all()
                )
                stats["tecdoc_scanned"] = int(stats.get("tecdoc_scanned", 0)) + len(cross_rows)
                for cross_article, supplier_name in cross_rows:
                    if inserted_tecdoc >= tecdoc_budget or stats["total"] >= total_limit:
                        break
                    brand = map_tecdoc_brand_to_rossko((supplier_name or "").strip())
                    article = (cross_article or "").strip()
                    if _try_add_pair(
                        db,
                        brand=brand,
                        article=article,
                        source=SOURCE_TECDOC,
                        priority=70,
                        seen=seen,
                        stats=stats,
                        stat_key="tecdoc",
                        total_limit=total_limit,
                    ):
                        inserted_tecdoc += 1
        except Exception:
            logger.exception("TecDoc catalog cross populate failed")

    if stats["total"] >= total_limit or inserted_tecdoc >= tecdoc_budget:
        return

    max_rounds = 20 if loop_harvest else 1
    for _round in range(max_rounds):
        if stats.get("tecdoc", 0) >= tecdoc_budget or stats["total"] >= total_limit:
            break

        direct_inserted = 0
        cross_inserted = 0
        direct_scanned = 0
        cross_scanned = 0

        try:
            direct_result = harvest_tecdoc_direct_pairs(
                db,
                seen=seen,
                stats=stats,
                total_limit=tecdoc_budget,
            )
            direct_inserted = int(direct_result.get("inserted", 0))
            direct_scanned = int(direct_result.get("scanned", 0))
        except Exception:
            logger.exception("TecDoc direct harvest during populate failed")

        if stats.get("tecdoc", 0) >= tecdoc_budget or stats["total"] >= total_limit:
            stats["tecdoc_harvest_rounds"] = int(stats.get("tecdoc_harvest_rounds", 0)) + 1
            stats["tecdoc_scanned"] = int(stats.get("tecdoc_scanned", 0)) + direct_scanned
            break

        try:
            cross_result = harvest_tecdoc_cross_pairs(
                db,
                seen=seen,
                stats=stats,
                total_limit=tecdoc_budget,
            )
            cross_inserted = int(cross_result.get("inserted", 0))
            cross_scanned = int(cross_result.get("scanned", 0))
        except Exception:
            logger.exception("TecDoc cross harvest during populate failed")

        stats["tecdoc_harvest_rounds"] = int(stats.get("tecdoc_harvest_rounds", 0)) + 1
        stats["tecdoc_scanned"] = int(stats.get("tecdoc_scanned", 0)) + direct_scanned + cross_scanned

        if direct_inserted == 0 and cross_inserted == 0:
            break


def _populate_landing(db: Session, *, seen: set[str], stats: dict[str, int], limit: int) -> None:
    landing_limit = min(3000, limit - stats["total"])
    if landing_limit <= 0:
        return

    rows = (
        db.query(SeoLandingPage)
        .filter(SeoLandingPage.is_active.is_(True))
        .order_by(SeoLandingPage.priority.asc(), SeoLandingPage.id.asc())
        .all()
    )
    landing_added = 0

    for row in rows:
        if landing_added >= landing_limit or stats["total"] >= limit:
            break

        if row.kind == "brand_new" and row.brand_name:
            brand_name = row.brand_name.strip()
            card_rows = (
                db.query(NewPartsSeoCard.brand, NewPartsSeoCard.article)
                .filter(
                    NewPartsSeoCard.is_active.is_(True),
                    func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
                    func.lower(NewPartsSeoCard.brand) == brand_name.casefold(),
                )
                .order_by(NewPartsSeoCard.id.desc())
                .limit(20)
                .all()
            )
            if card_rows:
                for card_brand, card_article in card_rows:
                    if _try_add_pair(
                        db,
                        brand=card_brand,
                        article=card_article,
                        source=SOURCE_LANDING,
                        priority=45,
                        seen=seen,
                        stats=stats,
                        stat_key="landing",
                        total_limit=limit,
                    ):
                        landing_added += 1
            else:
                for brand, article in load_semantic_seed_pairs():
                    if brand.casefold() != brand_name.casefold():
                        continue
                    if _try_add_pair(
                        db,
                        brand=brand,
                        article=article,
                        source=SOURCE_LANDING,
                        priority=45,
                        seen=seen,
                        stats=stats,
                        stat_key="landing",
                        total_limit=limit,
                    ):
                        landing_added += 1

        elif row.kind == "category_new" and row.slug:
            cards, _total = list_new_part_cards_by_category_slug(db, row.slug, page=1, page_size=15)
            for card in cards:
                if _try_add_pair(
                    db,
                    brand=card.brand,
                    article=card.article,
                    source=SOURCE_LANDING,
                    priority=50,
                    seen=seen,
                    stats=stats,
                    stat_key="landing",
                    total_limit=limit,
                ):
                    landing_added += 1

        elif row.kind in {"brand_used", "category_used"}:
            for product in _iter_catalog_products(db):
                if stats["total"] >= limit or landing_added >= landing_limit:
                    break
                if not is_working_catalog_product(product):
                    continue
                brand = (product.brand or "").strip()
                article = (product.article or "").strip()
                if row.kind == "brand_used" and row.brand_name:
                    if brand.casefold() != row.brand_name.strip().casefold():
                        continue
                elif row.part_type_id:
                    if product.part_type_id != row.part_type_id:
                        continue
                else:
                    continue
                if _try_add_pair(
                    db,
                    brand=brand,
                    article=article,
                    source=SOURCE_LANDING,
                    priority=55,
                    seen=seen,
                    stats=stats,
                    stat_key="landing",
                    total_limit=limit,
                ):
                    landing_added += 1
                    if landing_added >= landing_limit:
                        break


def _populate_card_cross_mining(db: Session, *, seen: set[str], stats: dict[str, int], limit: int) -> None:
    from app.services.new_parts_seo_sync_service import extract_discovery_candidates_from_rossko

    mining_limit = min(500, limit - stats["total"])
    if mining_limit <= 0:
        return

    since = _utcnow() - timedelta(days=7)
    payload_rows = (
        db.query(SeoRosskoSeedQueue)
        .filter(
            SeoRosskoSeedQueue.rossko_payload_json.isnot(None),
            SeoRosskoSeedQueue.status.in_(["ready", "created"]),
        )
        .order_by(SeoRosskoSeedQueue.updated_at.desc())
        .limit(200)
        .all()
    )
    mined = 0
    for row in payload_rows:
        if mined >= mining_limit or stats["total"] >= limit:
            break
        try:
            data = json.loads(row.rossko_payload_json or "{}")
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        discoveries = extract_discovery_candidates_from_rossko(
            data,
            query_brand=row.brand,
            query_article=row.article,
        )
        for candidate in discoveries:
            if _try_add_pair(
                db,
                brand=candidate.brand,
                article=candidate.article,
                source=SOURCE_CARD_CROSS,
                priority=55,
                seen=seen,
                stats=stats,
                stat_key="card_cross",
                total_limit=limit,
            ):
                mined += 1

    card_rows = (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
            NewPartsSeoCard.created_at >= since,
        )
        .order_by(NewPartsSeoCard.created_at.desc())
        .limit(300)
        .all()
    )
    for card in card_rows:
        if mined >= mining_limit or stats["total"] >= limit:
            break
        seed_row = (
            db.query(SeoRosskoSeedQueue)
            .filter(SeoRosskoSeedQueue.lookup_key == build_product_lookup_key(card.brand, card.article))
            .first()
        )
        if seed_row and seed_row.rossko_payload_json:
            continue
        if _try_add_pair(
            db,
            brand=card.brand,
            article=card.article,
            source=SOURCE_CARD_CROSS,
            priority=60,
            seen=seen,
            stats=stats,
            stat_key="card_cross",
            total_limit=limit,
        ):
            mined += 1


def populate_seed_queue_from_catalog(
    db: Session,
    *,
    limit: int | None = None,
    loop_tecdoc_harvest: bool = False,
) -> dict[str, int]:
    from app.services.new_parts_seo_sync_service import (
        collect_distinct_product_candidates,
        collect_order_item_candidates,
    )

    total_limit = limit if limit is not None else int(settings.NEW_PARTS_SEO_SEED_POPULATE_LIMIT or 20000)
    tecdoc_limit = int(settings.NEW_PARTS_SEO_SEED_TECDOC_LIMIT or 100000)
    tecdoc_budget = min(tecdoc_limit, total_limit)
    stats: dict[str, int] = {
        "orders": 0,
        "products": 0,
        "tecdoc": 0,
        "semantic": 0,
        "landing": 0,
        "card_cross": 0,
        "total": 0,
        "tecdoc_scanned": 0,
        "tecdoc_harvest_rounds": 0,
    }
    seen: set[str] = set()

    _populate_tecdoc(
        db,
        seen=seen,
        stats=stats,
        total_limit=total_limit,
        tecdoc_budget=tecdoc_budget,
        loop_harvest=loop_tecdoc_harvest,
    )

    if stats["total"] < total_limit:
        for collector, key in (
            (collect_order_item_candidates, "orders"),
            (collect_distinct_product_candidates, "products"),
        ):
            for candidate in collector(db):
                _try_add_pair(
                    db,
                    brand=candidate.brand,
                    article=candidate.article,
                    source=candidate.source,
                    priority=10 if key == "orders" else 20,
                    seen=seen,
                    stats=stats,
                    stat_key=key,
                    total_limit=total_limit,
                )
                if stats["total"] >= total_limit:
                    return stats

    if stats["total"] < total_limit:
        _populate_semantic(db, seen=seen, stats=stats, limit=total_limit)
    if stats["total"] < total_limit:
        _populate_landing(db, seen=seen, stats=stats, limit=total_limit)
    if stats["total"] < total_limit:
        _populate_card_cross_mining(db, seen=seen, stats=stats, limit=total_limit)
    return stats


def list_ready_seed_candidates(db: Session, *, limit: int = 100) -> list[SyncCandidate]:
    rows = (
        db.query(SeoRosskoSeedQueue)
        .filter(SeoRosskoSeedQueue.status == "ready")
        .order_by(SeoRosskoSeedQueue.priority.asc(), SeoRosskoSeedQueue.updated_at.asc())
        .limit(max(1, limit))
        .all()
    )
    return [
        SyncCandidate(
            lookup_key=row.lookup_key,
            brand=row.brand,
            article=row.article,
            source=SOURCE_SEED_READY,
            origin_source=row.source,
        )
        for row in rows
    ]


def get_seed_queue_row(db: Session, lookup_key: str) -> SeoRosskoSeedQueue | None:
    return (
        db.query(SeoRosskoSeedQueue)
        .filter(SeoRosskoSeedQueue.lookup_key == lookup_key)
        .first()
    )


def mark_seed_created(db: Session, lookup_key: str) -> None:
    row = get_seed_queue_row(db, lookup_key)
    if row:
        row.status = "created"
        row.updated_at = _utcnow()
        db.commit()


def mark_seed_not_found(db: Session, lookup_key: str, *, retry_days: int | None = None) -> None:
    row = get_seed_queue_row(db, lookup_key)
    if row:
        days = retry_days if retry_days is not None else settings.NEW_PARTS_SEO_SEED_NOT_FOUND_RETRY_DAYS
        row.status = "not_found"
        row.next_retry_at = _utcnow() + timedelta(days=days)
        row.rossko_checked_at = _utcnow()
        db.commit()


def mark_seed_ready(db: Session, lookup_key: str, rossko_data: dict) -> None:
    row = get_seed_queue_row(db, lookup_key)
    if row:
        row.status = "ready"
        row.rossko_payload_json = json.dumps(rossko_data, ensure_ascii=False)
        row.rossko_checked_at = _utcnow()
        row.next_retry_at = None
        row.updated_at = _utcnow()
        db.commit()


def is_seed_payload_fresh(row: SeoRosskoSeedQueue, *, max_age_hours: int = 24) -> bool:
    if not row.rossko_checked_at or not row.rossko_payload_json:
        return False
    age = _utcnow() - row.rossko_checked_at
    return age <= timedelta(hours=max_age_hours)


def load_seed_payload(row: SeoRosskoSeedQueue) -> dict | None:
    if not row.rossko_payload_json:
        return None
    try:
        return json.loads(row.rossko_payload_json)
    except json.JSONDecodeError:
        return None


def _reactivate_due_not_found(db: Session, *, limit: int = 500) -> int:
    now = _utcnow()
    rows = (
        db.query(SeoRosskoSeedQueue)
        .filter(
            SeoRosskoSeedQueue.status == "not_found",
            SeoRosskoSeedQueue.next_retry_at.isnot(None),
            SeoRosskoSeedQueue.next_retry_at <= now,
        )
        .order_by(SeoRosskoSeedQueue.next_retry_at.asc())
        .limit(max(1, limit))
        .all()
    )
    for row in rows:
        row.status = "pending"
        row.next_retry_at = None
    if rows:
        db.commit()
    return len(rows)


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


def _rossko_has_in_stock(data: dict | None) -> bool:
    from app.services.rossko_part_selection import extract_rossko_parts

    if not data:
        return False
    for part in extract_rossko_parts(data):
        if get_rossko_stock_count(part) > 0:
            return True
    return False


def _resolve_precheck_batch_size(db: Session, requested: int | None) -> int:
    budget = precheck_budget_remaining(db)
    if budget <= 0:
        return 0
    ready_count = count_seed_queue_by_status(db, "ready")
    target = int(settings.NEW_PARTS_SEO_SEED_READY_TARGET or 1500)
    from app.services.new_parts_seo_sync_service import count_seo_cards_created_today

    daily_limit = int(settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT or 1000)
    created_today = count_seo_cards_created_today(db)
    deficit = max(0, daily_limit - created_today)

    batch = requested if requested is not None else budget
    if ready_count < deficit or ready_count < target:
        batch = min(budget, max(batch, budget // 2))
    return max(0, min(budget, batch))


PRECHECK_SOURCE_ORDER: tuple[str, ...] = (
    "tecdoc",
    "semantic",
    "order",
    "product",
    "landing",
    "card_cross",
)


def _select_pending_seed_rows_fair(db: Session, *, limit: int) -> list[SeoRosskoSeedQueue]:
    now = _utcnow()
    base_query = db.query(SeoRosskoSeedQueue).filter(
        SeoRosskoSeedQueue.status == "pending",
        (SeoRosskoSeedQueue.next_retry_at.is_(None)) | (SeoRosskoSeedQueue.next_retry_at <= now),
    )
    source_rows = (
        base_query.with_entities(SeoRosskoSeedQueue.source)
        .distinct()
        .all()
    )
    active_sources = [str(row[0]) for row in source_rows if row and row[0]]
    if not active_sources:
        return []

    ordered_sources = [src for src in PRECHECK_SOURCE_ORDER if src in active_sources]
    ordered_sources.extend(src for src in active_sources if src not in ordered_sources)
    per_source = max(1, limit // max(1, len(ordered_sources)))

    buckets: dict[str, list[SeoRosskoSeedQueue]] = {}
    for src in ordered_sources:
        buckets[src] = (
            base_query.filter(SeoRosskoSeedQueue.source == src)
            .order_by(SeoRosskoSeedQueue.priority.asc(), SeoRosskoSeedQueue.created_at.asc())
            .limit(per_source)
            .all()
        )

    selected: list[SeoRosskoSeedQueue] = []
    while len(selected) < limit:
        added = False
        for src in ordered_sources:
            queue = buckets.get(src) or []
            if not queue:
                continue
            selected.append(queue.pop(0))
            added = True
            if len(selected) >= limit:
                break
        if not added:
            break
    return selected


async def _precheck_seed_row(db: Session, row: SeoRosskoSeedQueue) -> bool:
    search_brand = (
        map_tecdoc_brand_to_rossko(row.brand)
        if row.source == SOURCE_TECDOC
        else row.brand
    )
    search_text = f"{search_brand} {row.article}".strip()
    data = await _fetch_rossko_search(db, search_text)
    if _rossko_has_in_stock(data):
        mark_seed_ready(db, row.lookup_key, data)
        return True

    if row.source == SOURCE_TECDOC:
        article_only = (row.article or "").strip()
        if article_only and article_only.casefold() != search_text.casefold():
            data = await _fetch_rossko_search(db, article_only)
            if _rossko_has_in_stock(data):
                mark_seed_ready(db, row.lookup_key, data)
                return True

    mark_seed_not_found(db, row.lookup_key)
    return False


async def run_seed_precheck_batch(db: Session, *, max_checks: int | None = None) -> dict[str, int]:
    ready_count = count_seed_queue_by_status(db, "ready")
    target = int(settings.NEW_PARTS_SEO_SEED_READY_TARGET or 1500)
    if ready_count < min(200, target):
        _reactivate_due_not_found(db, limit=500)

    limit = _resolve_precheck_batch_size(db, max_checks)
    if limit <= 0:
        return {"checked": 0, "ready": 0, "not_found": 0, "skipped": 0, "reactivated": 0}

    rows = _select_pending_seed_rows_fair(db, limit=limit)

    stats = {"checked": 0, "ready": 0, "not_found": 0, "skipped": 0, "reactivated": 0}
    delay = float(settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC or 0)

    import asyncio

    for row in rows:
        if precheck_budget_remaining(db) <= 0:
            break
        stats["checked"] += 1
        increment_precheck_calls(db)
        try:
            if await _precheck_seed_row(db, row):
                stats["ready"] += 1
            else:
                stats["not_found"] += 1
        except Exception:
            logger.exception("Seed precheck failed for %s", row.lookup_key)
            stats["skipped"] += 1
        if delay > 0:
            await asyncio.sleep(delay)

    return stats


async def maybe_run_precheck_boost(db: Session) -> dict[str, int] | None:
    ready_count = count_seed_queue_by_status(db, "ready")
    from app.services.new_parts_seo_sync_service import count_seo_cards_created_today

    daily_limit = int(settings.NEW_PARTS_SEO_SYNC_DAILY_LIMIT or 1000)
    created_today = count_seo_cards_created_today(db)
    deficit = max(0, daily_limit - created_today)
    if ready_count >= deficit or precheck_budget_remaining(db) <= 0:
        return None
    return await run_seed_precheck_batch(db)
