from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.tecdoc import TecdocArticle, TecdocArticleCrossList, TecdocSupplier
from app.services.seo_pipeline_state_service import (
    get_tecdoc_cross_cursor,
    get_tecdoc_direct_cursor,
    set_tecdoc_cross_cursor,
    set_tecdoc_direct_cursor,
)
from app.services.seo_rossko_seed_service import SOURCE_TECDOC, _try_add_pair
from app.services.seo_tecdoc_brand_service import (
    is_tecdoc_brand_whitelisted,
    map_tecdoc_brand_to_rossko,
)

logger = logging.getLogger(__name__)


def _rossko_brand_whitelist_from_cards(db: Session, *, limit: int = 200) -> set[str]:
    rows = (
        db.query(NewPartsSeoCard.brand)
        .filter(NewPartsSeoCard.is_active.is_(True))
        .distinct()
        .limit(limit)
        .all()
    )
    return {" ".join((row[0] or "").strip().upper().split()) for row in rows if row and row[0]}


def harvest_tecdoc_direct_pairs(
    db: Session,
    *,
    batch_size: int | None = None,
    seen: set[str] | None = None,
    stats: dict[str, int] | None = None,
    total_limit: int | None = None,
) -> dict[str, int]:
    """Scan tecdoc_articles + suppliers and enqueue brand/article pairs for Rossko precheck."""
    batch = batch_size if batch_size is not None else int(settings.NEW_PARTS_SEO_TECDOC_HARVEST_BATCH or 10000)
    local_stats = stats if stats is not None else {"tecdoc": 0, "total": 0}
    local_seen = seen if seen is not None else set()
    limit = total_limit if total_limit is not None else int(settings.NEW_PARTS_SEO_SEED_TECDOC_LIMIT or 100000)
    card_brands = _rossko_brand_whitelist_from_cards(db)
    cursor = get_tecdoc_direct_cursor(db)
    inserted = 0

    try:
        rows = (
            db.query(
                TecdocArticle.id,
                TecdocArticle.DataSupplierArticleNumber,
                TecdocSupplier.Description,
            )
            .join(TecdocSupplier, TecdocSupplier.id == TecdocArticle.Supplier)
            .filter(
                TecdocArticle.DataSupplierArticleNumber.isnot(None),
                TecdocArticle.id > cursor,
            )
            .order_by(TecdocArticle.id.asc())
            .limit(batch)
            .all()
        )
    except Exception:
        logger.exception("TecDoc direct harvest query failed")
        return {"inserted": 0, "cursor": cursor, "scanned": 0}

    last_id = cursor
    scanned = 0
    for article_id, article_raw, supplier_name in rows:
        scanned += 1
        last_id = max(last_id, int(article_id or 0))
        if inserted >= batch or local_stats.get("tecdoc", 0) >= limit or local_stats["total"] >= limit:
            break
        supplier_text = (supplier_name or "").strip()
        if not is_tecdoc_brand_whitelisted(supplier_text, extra_brands=card_brands):
            continue
        brand = map_tecdoc_brand_to_rossko(supplier_text)
        article = (article_raw or "").strip()
        if _try_add_pair(
            db,
            brand=brand,
            article=article,
            source=SOURCE_TECDOC,
            priority=80,
            seen=local_seen,
            stats=local_stats,
            stat_key="tecdoc",
            total_limit=limit,
        ):
            inserted += 1

    if rows and last_id > cursor:
        set_tecdoc_direct_cursor(db, last_id)

    return {"inserted": inserted, "cursor": last_id, "scanned": scanned}


def harvest_tecdoc_cross_pairs(
    db: Session,
    *,
    batch_size: int | None = None,
    seen: set[str] | None = None,
    stats: dict[str, int] | None = None,
    total_limit: int | None = None,
) -> dict[str, int]:
    """Scan tecdoc_article_cross_list in cursor batches."""
    batch = batch_size if batch_size is not None else int(settings.NEW_PARTS_SEO_TECDOC_CROSS_BATCH or 5000)
    local_stats = stats if stats is not None else {"tecdoc": 0, "total": 0}
    local_seen = seen if seen is not None else set()
    limit = total_limit if total_limit is not None else int(settings.NEW_PARTS_SEO_SEED_TECDOC_LIMIT or 100000)
    card_brands = _rossko_brand_whitelist_from_cards(db)
    cursor = get_tecdoc_cross_cursor(db)
    inserted = 0

    try:
        rows = (
            db.query(TecdocArticleCrossList.Article, TecdocSupplier.Description, TecdocArticleCrossList.article_id)
            .join(TecdocArticle, TecdocArticle.id == TecdocArticleCrossList.article_id)
            .join(TecdocSupplier, TecdocSupplier.id == TecdocArticleCrossList.supplier)
            .filter(TecdocArticleCrossList.article_id > cursor)
            .order_by(TecdocArticleCrossList.article_id.asc())
            .limit(batch)
            .all()
        )
    except Exception:
        logger.exception("TecDoc cross harvest query failed")
        return {"inserted": 0, "cursor": cursor, "scanned": 0}

    last_id = cursor
    scanned = 0
    for cross_article, supplier_name, article_id in rows:
        scanned += 1
        if inserted >= batch or local_stats.get("tecdoc", 0) >= limit or local_stats["total"] >= limit:
            break
        last_id = max(last_id, int(article_id or 0))
        supplier_text = (supplier_name or "").strip()
        if not is_tecdoc_brand_whitelisted(supplier_text, extra_brands=card_brands):
            continue
        brand = map_tecdoc_brand_to_rossko(supplier_text)
        article = (cross_article or "").strip()
        if _try_add_pair(
            db,
            brand=brand,
            article=article,
            source=SOURCE_TECDOC,
            priority=75,
            seen=local_seen,
            stats=local_stats,
            stat_key="tecdoc",
            total_limit=limit,
        ):
            inserted += 1

    if rows:
        set_tecdoc_cross_cursor(db, last_id)

    return {"inserted": inserted, "cursor": last_id, "scanned": scanned}
