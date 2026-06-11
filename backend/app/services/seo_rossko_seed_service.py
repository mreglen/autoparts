from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import engine
from app.models.garage_new_orders import GarageNewOrderItem
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.seo_rossko_seed_queue import SeoRosskoSeedQueue
from app.models.tecdoc import TecdocArticle, TecdocArticleCrossList, TecdocSupplier
from app.schemas.rossko import SearchRequest
from app.services.new_parts_seo_card_service import ROSSKO_NEW_PART_SOURCE, _stable_key
from app.services.rossko_part_selection import get_rossko_stock_count
from app.services.seo_quota_service import increment_precheck_calls, precheck_budget_remaining
from app.services.seo_sync_types import SOURCE_SEED_READY, SyncCandidate
from app.services.sitemap_service import is_working_catalog_product
from app.services.yandex_feed_xml_service import _iter_catalog_products
from app.utils.partnumber import build_product_lookup_key

logger = logging.getLogger(__name__)

SOURCE_TECDOC = "tecdoc"
SOURCE_SEMANTIC = "semantic"

SEMANTIC_SEED_PAIRS: list[tuple[str, str]] = [
    ("BOSCH", "0986424590"),
    ("MANN", "W712/75"),
    ("NGK", "96535"),
    ("FEBI", "37424"),
    ("KNECHT", "OX188"),
    ("SAKURA", "FC1101"),
    ("KAYABA", "334001"),
    ("HYUNDAI", "2630035504"),
    ("GRAF", "PA1234"),
]


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


def populate_seed_queue_from_catalog(db: Session, *, limit: int = 5000) -> dict[str, int]:
    from app.services.new_parts_seo_sync_service import (
        collect_distinct_product_candidates,
        collect_order_item_candidates,
    )

    stats = {"orders": 0, "products": 0, "tecdoc": 0, "semantic": 0, "total": 0}
    seen: set[str] = set()

    for collector, key in (
        (collect_order_item_candidates, "orders"),
        (collect_distinct_product_candidates, "products"),
    ):
        for candidate in collector(db):
            if candidate.lookup_key in seen:
                continue
            seen.add(candidate.lookup_key)
            if _upsert_seed_row(
                db,
                lookup_key=candidate.lookup_key,
                brand=candidate.brand,
                article=candidate.article,
                source=candidate.source,
            ):
                stats[key] += 1
                stats["total"] += 1
            if stats["total"] >= limit:
                return stats

    for brand, article in SEMANTIC_SEED_PAIRS:
        lookup_key = build_product_lookup_key(brand, article)
        if not lookup_key or lookup_key in seen:
            continue
        seen.add(lookup_key)
        if _upsert_seed_row(
            db,
            lookup_key=lookup_key,
            brand=brand,
            article=article,
            source=SOURCE_SEMANTIC,
            priority=50,
        ):
            stats["semantic"] += 1
            stats["total"] += 1

    catalog_articles: list[tuple[str, str]] = []
    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        brand = (product.brand or "").strip()
        article = (product.article or "").strip()
        if brand and article:
            catalog_articles.append((brand, article))
        if len(catalog_articles) >= 500:
            break

    try:
        article_numbers = [article for _, article in catalog_articles[:200]]
        if article_numbers:
            cross_rows = (
                db.query(TecdocArticleCrossList.Article, TecdocSupplier.Description)
                .join(
                    TecdocArticle,
                    TecdocArticle.id == TecdocArticleCrossList.article_id,
                )
                .join(
                    TecdocSupplier,
                    TecdocSupplier.id == TecdocArticleCrossList.supplier,
                )
                .filter(TecdocArticleCrossList.Article.in_(article_numbers))
                .limit(1000)
                .all()
            )
            for cross_article, supplier_name in cross_rows:
                brand = (supplier_name or "").strip()
                article = (cross_article or "").strip()
                lookup_key = build_product_lookup_key(brand, article)
                if not lookup_key or lookup_key in seen:
                    continue
                seen.add(lookup_key)
                if _upsert_seed_row(
                    db,
                    lookup_key=lookup_key,
                    brand=brand,
                    article=article,
                    source=SOURCE_TECDOC,
                    priority=80,
                ):
                    stats["tecdoc"] += 1
                    stats["total"] += 1
    except Exception:
        logger.exception("TecDoc seed populate failed")

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


async def run_seed_precheck_batch(db: Session, *, max_checks: int | None = None) -> dict[str, int]:
    budget = precheck_budget_remaining(db)
    if budget <= 0:
        return {"checked": 0, "ready": 0, "not_found": 0, "skipped": 0}

    limit = min(budget, max_checks or budget)
    now = _utcnow()
    rows = (
        db.query(SeoRosskoSeedQueue)
        .filter(
            SeoRosskoSeedQueue.status == "pending",
            (SeoRosskoSeedQueue.next_retry_at.is_(None)) | (SeoRosskoSeedQueue.next_retry_at <= now),
        )
        .order_by(SeoRosskoSeedQueue.priority.asc(), SeoRosskoSeedQueue.created_at.asc())
        .limit(limit)
        .all()
    )

    stats = {"checked": 0, "ready": 0, "not_found": 0, "skipped": 0}
    delay = float(settings.NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC or 0)

    import asyncio

    for row in rows:
        if precheck_budget_remaining(db) <= 0:
            break
        stats["checked"] += 1
        increment_precheck_calls(db)
        try:
            search_text = f"{row.brand} {row.article}".strip()
            data = await _fetch_rossko_search(db, search_text)
            if _rossko_has_in_stock(data):
                mark_seed_ready(db, row.lookup_key, data)
                stats["ready"] += 1
            else:
                mark_seed_not_found(db, row.lookup_key)
                stats["not_found"] += 1
        except Exception:
            logger.exception("Seed precheck failed for %s", row.lookup_key)
            stats["skipped"] += 1
        if delay > 0:
            await asyncio.sleep(delay)

    return stats
