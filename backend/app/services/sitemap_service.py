from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models.product import Product as ProductModel
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.seo_product_url_export import SeoProductUrlExport
from app.models.seo_new_part_url_export import SeoNewPartUrlExport
from app.models.seo_sitemap_cache import SeoSitemapCache
from app.models.seo_landing_page import SeoLandingPage
from app.services.new_parts_seo_card_service import (
    build_new_part_card_path,
    count_rossko_new_part_cards_for_sitemap,
    is_rossko_new_part_sitemap_eligible,
    iter_rossko_new_part_cards_for_sitemap,
)
from app.services.yandex_feed_xml_service import _iter_catalog_products, _resolve_site_origin
from app.utils.product_urls import build_product_page_url, build_product_used_catalog_url, build_used_catalog_url_for_query
from app.utils.partnumber import normalize_partnumber
from app.utils.yandex_integration_db import get_or_create_yandex_integration

DEFAULT_PRODUCT_URLS_LIMIT = 150
PRODUCT_URL_DOWNLOAD_LIMIT = DEFAULT_PRODUCT_URLS_LIMIT


def get_seo_sitemap_daily_url_limit() -> int:
    return max(1, int(settings.SEO_SITEMAP_DAILY_URL_LIMIT or DEFAULT_PRODUCT_URLS_LIMIT))


PRODUCTS_SITEMAP_CACHE_KEY = "products"
NEW_PARTS_SITEMAP_CACHE_KEY = "new_parts"
NEW_PARTS_SITEMAP_PAGE_CACHE_PREFIX = "new_parts_p"
# Keep child files small (~1MB) so crawlers/browsers do not time out on 10MB+ XML.
NEW_PARTS_SITEMAP_MAX_URLS = 5000
NEW_BRANDS_SITEMAP_CACHE_KEY = "new_brands"
NEW_CATEGORIES_SITEMAP_CACHE_KEY = "new_categories"
USED_BRANDS_SITEMAP_CACHE_KEY = "used_brands"
USED_CATEGORIES_SITEMAP_CACHE_KEY = "used_categories"
USED_GEO_SITEMAP_CACHE_KEY = "used_geo"
SITEMAP_CACHE_MAX_AGE_SECONDS = 86400

logger = logging.getLogger(__name__)


def _new_parts_page_cache_key(page: int) -> str:
    return f"{NEW_PARTS_SITEMAP_PAGE_CACHE_PREFIX}{page}"


_SITEMAP_URL_BLOCK_RE = re.compile(r"  <url>.*?</url>", re.DOTALL)


def _extract_sitemap_url_blocks(xml_content: str) -> list[str]:
    if not xml_content:
        return []
    return _SITEMAP_URL_BLOCK_RE.findall(xml_content)


def _empty_urlset_xml() -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "</urlset>\n"
    )


def _build_urlset_xml(entries: list[str]) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        *entries,
        "</urlset>",
    ]
    return "\n".join(lines) + "\n"


def _build_new_parts_sitemap_index_xml(
    site_origin: str,
    *,
    page_count: int,
    generated_at: datetime | None = None,
) -> str:
    origin = site_origin.rstrip("/")
    lastmod = _sitemap_index_lastmod_line(generated_at)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for page in range(1, page_count + 1):
        lines.extend(
            [
                "  <sitemap>",
                f"    <loc>{origin}/api/feeds/sitemap-new-parts-{page}.xml</loc>",
                lastmod.rstrip("\n") if lastmod else "",
                "  </sitemap>",
            ]
        )
    lines.append("</sitemapindex>")
    return "\n".join(line for line in lines if line) + "\n"


def _collect_new_parts_sitemap_entries(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> list[str]:
    site_origin = _resolve_origin(db, preferred_host_url)
    entries: list[str] = []
    for card in iter_rossko_new_part_cards_for_sitemap(db):
        _loc, entry = _new_part_sitemap_url_block(site_origin, card)
        entries.append(entry)
    return entries


def _delete_new_parts_page_caches(db: Session, *, keep_pages: int) -> None:
    prefix = f"{NEW_PARTS_SITEMAP_PAGE_CACHE_PREFIX}%"
    rows = (
        db.query(SeoSitemapCache)
        .filter(SeoSitemapCache.cache_key.like(prefix))
        .all()
    )
    changed = False
    for row in rows:
        suffix = row.cache_key.removeprefix(NEW_PARTS_SITEMAP_PAGE_CACHE_PREFIX)
        if not suffix.isdigit():
            continue
        if int(suffix) > keep_pages:
            db.delete(row)
            changed = True
    if changed:
        db.commit()


def _count_new_parts_page_caches(db: Session) -> int:
    prefix = f"{NEW_PARTS_SITEMAP_PAGE_CACHE_PREFIX}%"
    rows = (
        db.query(SeoSitemapCache.cache_key)
        .filter(SeoSitemapCache.cache_key.like(prefix))
        .all()
    )
    page_numbers = []
    for (cache_key,) in rows:
        suffix = cache_key.removeprefix(NEW_PARTS_SITEMAP_PAGE_CACHE_PREFIX)
        if suffix.isdigit():
            page_numbers.append(int(suffix))
    return max(page_numbers) if page_numbers else 0


def _persist_new_parts_sitemap_index(
    db: Session,
    *,
    site_origin: str,
    page_count: int,
    total_url_count: int,
) -> NewPartsSitemapSnapshot:
    generated_at = datetime.now(timezone.utc)
    index_xml = _build_new_parts_sitemap_index_xml(
        site_origin,
        page_count=page_count,
        generated_at=generated_at,
    )
    return _persist_sitemap_cache(
        db,
        cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
        xml_content=index_xml,
        url_count=total_url_count,
    )


def _collect_cached_new_parts_url_blocks(db: Session, index_row: SeoSitemapCache) -> list[str]:
    if "<sitemapindex" not in (index_row.xml_content or ""):
        return _extract_sitemap_url_blocks(index_row.xml_content or "")

    blocks: list[str] = []
    page_count = _count_new_parts_page_caches(db)
    for page in range(1, page_count + 1):
        page_row = _get_sitemap_cache_row(db, _new_parts_page_cache_key(page))
        if page_row is None or not page_row.xml_content:
            continue
        blocks.extend(_extract_sitemap_url_blocks(page_row.xml_content))
    return blocks


def _write_new_parts_pages_from_blocks(
    db: Session,
    *,
    site_origin: str,
    blocks: list[str],
) -> NewPartsSitemapSnapshot:
    if not blocks:
        _delete_new_parts_page_caches(db, keep_pages=0)
        return _persist_sitemap_cache(
            db,
            cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
            xml_content=_empty_urlset_xml(),
            url_count=0,
        )

    pages: list[tuple[str, int]] = []
    for start in range(0, len(blocks), NEW_PARTS_SITEMAP_MAX_URLS):
        chunk = blocks[start:start + NEW_PARTS_SITEMAP_MAX_URLS]
        pages.append((_build_urlset_xml(chunk), len(chunk)))

    if len(pages) == 1:
        _delete_new_parts_page_caches(db, keep_pages=0)
        return _persist_sitemap_cache(
            db,
            cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
            xml_content=pages[0][0],
            url_count=pages[0][1],
        )

    for page_num, (xml_content, url_count) in enumerate(pages, start=1):
        _persist_sitemap_cache(
            db,
            cache_key=_new_parts_page_cache_key(page_num),
            xml_content=xml_content,
            url_count=url_count,
        )
    _delete_new_parts_page_caches(db, keep_pages=len(pages))
    return _persist_new_parts_sitemap_index(
        db,
        site_origin=site_origin,
        page_count=len(pages),
        total_url_count=len(blocks),
    )


def _new_parts_cache_needs_repage(db: Session, index_row: SeoSitemapCache) -> bool:
    if "<sitemapindex" not in (index_row.xml_content or ""):
        return int(index_row.url_count or 0) > NEW_PARTS_SITEMAP_MAX_URLS

    page_count = _count_new_parts_page_caches(db)
    if page_count <= 0:
        return True
    for page in range(1, page_count + 1):
        page_row = _get_sitemap_cache_row(db, _new_parts_page_cache_key(page))
        if page_row is None or not page_row.xml_content:
            return True
        if int(page_row.url_count or 0) > NEW_PARTS_SITEMAP_MAX_URLS:
            return True
    return False


def ensure_new_parts_sitemap_pages_sized(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> NewPartsSitemapSnapshot | None:
    """
    If cached child pages exceed NEW_PARTS_SITEMAP_MAX_URLS, split them in-place
    from cached XML (no full DB card scan). Returns updated index snapshot or None.
    """
    row = get_new_parts_sitemap_cache_row(db)
    if row is None or not row.xml_content:
        return None
    if not _new_parts_cache_needs_repage(db, row):
        return None

    site_origin = _resolve_origin(db, preferred_host_url)
    blocks = _collect_cached_new_parts_url_blocks(db, row)
    if not blocks and "<sitemapindex" in row.xml_content:
        # Broken page cache: fall back to full rebuild.
        return rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)

    logger.info(
        "Repaging new parts sitemap cache: urls=%s max_per_page=%s",
        len(blocks),
        NEW_PARTS_SITEMAP_MAX_URLS,
    )
    return _write_new_parts_pages_from_blocks(db, site_origin=site_origin, blocks=blocks)


@dataclass(frozen=True)
class SitemapCacheSnapshot:
    xml_content: str
    url_count: int
    generated_at: datetime


ProductsSitemapSnapshot = SitemapCacheSnapshot
NewPartsSitemapSnapshot = SitemapCacheSnapshot


def count_working_catalog_products(db: Session) -> int:
    count = 0
    for product in _iter_catalog_products(db):
        if is_working_catalog_product(product):
            count += 1
    return count


def count_active_new_part_cards(db: Session) -> int:
    return count_rossko_new_part_cards_for_sitemap(db)


def count_active_brand_new_landings(db: Session) -> int:
    return (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == "brand_new",
            SeoLandingPage.is_active.is_(True),
        )
        .count()
    )


def _count_active_landings(db: Session, kind: str) -> int:
    return (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == kind,
            SeoLandingPage.is_active.is_(True),
        )
        .count()
    )


def get_site_sitemap_files(db: Session, *, preferred_host_url: str | None = None) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    product_count = count_working_catalog_products(db)
    new_parts_count = count_active_new_part_cards(db)
    brand_landings_count = count_active_brand_new_landings(db)
    category_landings_count = _count_active_landings(db, "category_new")
    used_brand_count = _count_active_landings(db, "brand_used")
    used_category_count = _count_active_landings(db, "category_used")
    used_geo_count = _count_active_landings(db, "geo")
    static_pages_count = 10
    index_children = 8

    return [
        {
            "id": "index",
            "title": "Индекс sitemap",
            "description": "Корневой файл со списком всех sitemap сайта",
            "url": f"{site_origin}/sitemap.xml",
            "type": "index",
            "url_count": index_children,
            "location": "backend",
        },
        {
            "id": "pages",
            "title": "Статические страницы",
            "description": "Главная, каталог, разделы автозапчастей, организации и информационные страницы",
            "url": f"{site_origin}/sitemap-pages.xml",
            "type": "static",
            "url_count": static_pages_count,
            "location": "frontend/public",
        },
        {
            "id": "products",
            "title": "Карточки товаров",
            "description": "Карточки б/у и новых товаров из каталога",
            "url": f"{site_origin}/api/feeds/sitemap-products.xml",
            "type": "dynamic",
            "url_count": product_count,
            "location": "backend",
        },
        {
            "id": "new-parts",
            "title": "Новые запчасти (Rossko)",
            "description": "SEO-карточки Rossko из раздела /autoparts/new (только source=rossko с данными API)",
            "url": f"{site_origin}/api/feeds/sitemap-new-parts.xml",
            "type": "dynamic",
            "url_count": new_parts_count,
            "location": "backend",
        },
        {
            "id": "new-brands",
            "title": "Посадочные брендов (new)",
            "description": "SEO-страницы /autoparts/new/brand/{slug} из справочника seo_landing_pages",
            "url": f"{site_origin}/api/feeds/sitemap-new-brands.xml",
            "type": "dynamic",
            "url_count": brand_landings_count,
            "location": "backend",
        },
        {
            "id": "new-categories",
            "title": "Посадочные категорий (new)",
            "description": "SEO-страницы /autoparts/new/category/{slug}",
            "url": f"{site_origin}/api/feeds/sitemap-new-categories.xml",
            "type": "dynamic",
            "url_count": category_landings_count,
            "location": "backend",
        },
        {
            "id": "used-brands",
            "title": "Посадочные брендов (used)",
            "description": "SEO-страницы /autoparts/used/brand/{slug}",
            "url": f"{site_origin}/api/feeds/sitemap-used-brands.xml",
            "type": "dynamic",
            "url_count": used_brand_count,
            "location": "backend",
        },
        {
            "id": "used-categories",
            "title": "Посадочные категорий (used)",
            "description": "SEO-страницы /autoparts/used/category/{slug}",
            "url": f"{site_origin}/api/feeds/sitemap-used-categories.xml",
            "type": "dynamic",
            "url_count": used_category_count,
            "location": "backend",
        },
        {
            "id": "used-geo",
            "title": "Гео-посадочные (used)",
            "description": "SEO-страницы /autoparts/used/geo/{slug}",
            "url": f"{site_origin}/api/feeds/sitemap-used-geo.xml",
            "type": "dynamic",
            "url_count": used_geo_count,
            "location": "backend",
        },
    ]


def summarize_site_page_counts(items: Iterable[dict[str, str | int]]) -> int:
    """Sum indexable page URLs across sitemap feeds (excludes sitemap index metadata)."""
    return sum(
        int(item.get("url_count") or 0)
        for item in items
        if item.get("type") not in {"index", "admin"}
    )


def count_total_site_pages(db: Session, *, preferred_host_url: str | None = None) -> int:
    return summarize_site_page_counts(
        get_site_sitemap_files(db, preferred_host_url=preferred_host_url)
    )


def _resolve_origin(db: Session, preferred_host_url: str | None = None) -> str:
    if preferred_host_url:
        return _resolve_site_origin(preferred_host_url)
    row = get_or_create_yandex_integration(db)
    return _resolve_site_origin(row.host_url)


def _product_has_working_photo(product) -> bool:
    for photo in product.photos or []:
        photo_url = str(getattr(photo, "photo_url", "") or "").strip()
        if photo_url:
            return True
    return False


def is_working_catalog_product(product) -> bool:
    if (product.quantity or 0) <= 0:
        return False
    if not str(product.brand or "").strip():
        return False
    if not str(product.article or "").strip():
        return False
    if not str(product.name or "").strip():
        return False
    return _product_has_working_photo(product)


def _as_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _product_lastmod_date(product) -> date | None:
    """lastmod для URL товара: updated_at или created_at (UTC date)."""
    ts = _as_utc_datetime(getattr(product, "updated_at", None)) or _as_utc_datetime(
        getattr(product, "created_at", None)
    )
    return ts.date() if ts else None


def touch_product_seo_timestamp_if_newly_working_from_photo(
    db: Session,
    product,
    photo_record,
) -> None:
    """
    Сдвигает updated_at, когда товар впервые становится «рабочим» после обработки фото.
    """
    if product is None or photo_record is None or not is_working_catalog_product(product):
        return
    has_other_working_photo = any(
        int(getattr(p, "id", 0) or 0) != int(getattr(photo_record, "id", 0) or 0)
        and str(getattr(p, "photo_url", "") or "").strip()
        for p in (product.photos or [])
    )
    if has_other_working_photo:
        return
    product.updated_at = datetime.now(timezone.utc)
    db.commit()


def is_sitemap_cache_stale(generated_at: datetime | None) -> bool:
    if generated_at is None:
        return True
    ts = _as_utc_datetime(generated_at)
    if ts is None:
        return True
    age = datetime.now(timezone.utc) - ts
    return age.total_seconds() > SITEMAP_CACHE_MAX_AGE_SECONDS


def _export_date_today() -> date:
    return datetime.now(timezone.utc).date()


def _split_seo_url_limit(limit: int) -> tuple[int, int]:
    used_limit = limit // 2
    rossko_limit = limit - used_limit
    return used_limit, rossko_limit


def _exported_product_ids(db: Session) -> set[int]:
    rows = db.query(SeoProductUrlExport.product_id).all()
    return {int(row[0]) for row in rows}


def _exported_new_part_card_ids(db: Session) -> set[int]:
    rows = db.query(SeoNewPartUrlExport.card_id).all()
    return {int(row[0]) for row in rows}


def _product_to_url_item(product: ProductModel, site_origin: str) -> dict[str, str | int]:
    return {
        "id": int(product.id),
        "brand": str(product.brand or "").strip(),
        "article": str(product.article or "").strip(),
        "name": str(product.name or "").strip(),
        "url": build_product_page_url(product, site_origin),
    }


def _items_from_product_ids(
    db: Session,
    product_ids: Iterable[int],
    *,
    preferred_host_url: str | None = None,
) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    ids = list(product_ids)
    if not ids:
        return []

    products = (
        db.query(ProductModel)
        .filter(ProductModel.id.in_(ids))
        .all()
    )
    by_id = {int(p.id): p for p in products}
    items: list[dict[str, str | int]] = []
    for pid in ids:
        product = by_id.get(int(pid))
        if not product or not is_working_catalog_product(product):
            continue
        items.append(_product_to_url_item(product, site_origin))
    return items


def _new_part_to_url_item(card: NewPartsSeoCard, site_origin: str) -> dict[str, str | int]:
    return {
        "id": int(card.id),
        "brand": str(card.brand or "").strip(),
        "article": str(card.article or "").strip(),
        "name": str(card.name or "").strip(),
        "url": f"{site_origin.rstrip('/')}{build_new_part_card_path(int(card.id), card.brand, card.article)}",
    }


def _items_from_new_part_card_ids(
    db: Session,
    card_ids: Iterable[int],
    *,
    preferred_host_url: str | None = None,
) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    ids = list(card_ids)
    if not ids:
        return []

    cards = (
        db.query(NewPartsSeoCard)
        .filter(NewPartsSeoCard.id.in_(ids))
        .all()
    )
    by_id = {int(card.id): card for card in cards}
    items: list[dict[str, str | int]] = []
    for card_id in ids:
        card = by_id.get(int(card_id))
        if not card or not is_rossko_new_part_sitemap_eligible(card):
            continue
        items.append(_new_part_to_url_item(card, site_origin))
    return items


def collect_rossko_new_part_urls(
    db: Session,
    *,
    limit: int,
    preferred_host_url: str | None = None,
    exclude_card_ids: set[int] | None = None,
) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    excluded = exclude_card_ids or set()
    items: list[dict[str, str | int]] = []

    for card in iter_rossko_new_part_cards_for_sitemap(db):
        if int(card.id) in excluded:
            continue
        items.append(_new_part_to_url_item(card, site_origin))
        if len(items) >= limit:
            break

    return items


def collect_working_product_urls(
    db: Session,
    *,
    limit: int = DEFAULT_PRODUCT_URLS_LIMIT,
    preferred_host_url: str | None = None,
    exclude_product_ids: set[int] | None = None,
) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    excluded = exclude_product_ids or set()
    items: list[dict[str, str | int]] = []

    for product in _iter_catalog_products(db):
        if int(product.id) in excluded:
            continue
        if not is_working_catalog_product(product):
            continue
        items.append(_product_to_url_item(product, site_origin))
        if len(items) >= limit:
            break

    return items


def _iter_catalog_products_by_created_desc(db: Session) -> list[ProductModel]:
    """Последние товары в каталоге: у Product нет created_at, сортируем по id DESC."""
    return (
        db.query(ProductModel)
        .options(selectinload(ProductModel.photos))
        .filter(ProductModel.quantity > 0)
        .order_by(ProductModel.id.desc())
        .all()
    )


def collect_latest_working_product_urls(
    db: Session,
    *,
    limit: int = PRODUCT_URL_DOWNLOAD_LIMIT,
    preferred_host_url: str | None = None,
) -> list[dict[str, str | int]]:
    """
    Последние добавленные рабочие карточки б/у из таблицы products для SEO-выгрузки.
    Сортировка: id DESC (новые записи имеют больший id).
    """
    site_origin = _resolve_origin(db, preferred_host_url)
    items: list[dict[str, str | int]] = []

    for product in _iter_catalog_products_by_created_desc(db):
        if not is_working_catalog_product(product):
            continue
        items.append(_product_to_url_item(product, site_origin))
        if len(items) >= limit:
            break

    return items


def generate_latest_product_urls_download(
    db: Session,
    *,
    limit: int = PRODUCT_URL_DOWNLOAD_LIMIT,
    preferred_host_url: str | None = None,
) -> tuple[str, list[dict[str, str | int]], date]:
    items = collect_latest_working_product_urls(
        db,
        limit=limit,
        preferred_host_url=preferred_host_url,
    )
    if not items:
        return "", [], _export_date_today()
    urls = [str(item["url"]) for item in items]
    content = "\n".join(urls) + "\n"
    return content, items, _export_date_today()


def _load_or_create_used_url_batch(
    db: Session,
    *,
    today: date,
    used_limit: int,
    preferred_host_url: str | None,
) -> tuple[list[dict[str, str | int]], bool, bool]:
    existing_rows = (
        db.query(SeoProductUrlExport)
        .filter(SeoProductUrlExport.export_date == today)
        .order_by(SeoProductUrlExport.id.asc())
        .all()
    )
    if existing_rows:
        items = _items_from_product_ids(
            db,
            [row.product_id for row in existing_rows],
            preferred_host_url=preferred_host_url,
        )
        return items, False, False

    excluded = _exported_product_ids(db)
    items = collect_working_product_urls(
        db,
        limit=used_limit,
        preferred_host_url=preferred_host_url,
        exclude_product_ids=excluded,
    )
    pool_reset = False

    if not items and excluded:
        db.query(SeoProductUrlExport).delete(synchronize_session=False)
        db.flush()
        pool_reset = True
        items = collect_working_product_urls(
            db,
            limit=used_limit,
            preferred_host_url=preferred_host_url,
            exclude_product_ids=set(),
        )

    if not items:
        return [], False, pool_reset

    now = datetime.now(timezone.utc)
    for item in items:
        db.add(
            SeoProductUrlExport(
                product_id=int(item["id"]),
                export_date=today,
                exported_at=now,
            )
        )
    db.flush()
    return items, True, pool_reset


def _load_or_create_rossko_url_batch(
    db: Session,
    *,
    today: date,
    rossko_limit: int,
    preferred_host_url: str | None,
) -> tuple[list[dict[str, str | int]], bool, bool]:
    existing_rows = (
        db.query(SeoNewPartUrlExport)
        .filter(SeoNewPartUrlExport.export_date == today)
        .order_by(SeoNewPartUrlExport.id.asc())
        .all()
    )
    if existing_rows:
        items = _items_from_new_part_card_ids(
            db,
            [row.card_id for row in existing_rows],
            preferred_host_url=preferred_host_url,
        )
        return items, False, False

    excluded = _exported_new_part_card_ids(db)
    items = collect_rossko_new_part_urls(
        db,
        limit=rossko_limit,
        preferred_host_url=preferred_host_url,
        exclude_card_ids=excluded,
    )
    pool_reset = False

    if not items and excluded:
        db.query(SeoNewPartUrlExport).delete(synchronize_session=False)
        db.flush()
        pool_reset = True
        items = collect_rossko_new_part_urls(
            db,
            limit=rossko_limit,
            preferred_host_url=preferred_host_url,
            exclude_card_ids=set(),
        )

    if not items:
        return [], False, pool_reset

    now = datetime.now(timezone.utc)
    for item in items:
        db.add(
            SeoNewPartUrlExport(
                card_id=int(item["id"]),
                export_date=today,
                exported_at=now,
            )
        )
    db.flush()
    return items, True, pool_reset


def get_daily_seo_url_batch(
    db: Session,
    *,
    limit: int | None = None,
    preferred_host_url: str | None = None,
) -> tuple[list[dict[str, str | int]], list[dict[str, str | int]], date, bool, bool]:
    """
    Суточная порция URL для SEO: половина б/у карточек, половина Rossko.

    Returns: (used_items, rossko_items, export_date, created_new_batch, pool_was_reset)
    """
    effective_limit = limit if limit is not None else get_seo_sitemap_daily_url_limit()
    today = _export_date_today()
    used_limit, rossko_limit = _split_seo_url_limit(effective_limit)

    used_items, used_created, used_reset = _load_or_create_used_url_batch(
        db,
        today=today,
        used_limit=used_limit,
        preferred_host_url=preferred_host_url,
    )
    rossko_items, rossko_created, rossko_reset = _load_or_create_rossko_url_batch(
        db,
        today=today,
        rossko_limit=rossko_limit,
        preferred_host_url=preferred_host_url,
    )

    if used_created or rossko_created:
        db.commit()

    return (
        used_items,
        rossko_items,
        today,
        used_created or rossko_created,
        used_reset or rossko_reset,
    )


def generate_product_urls_text_file(
    db: Session,
    *,
    limit: int = DEFAULT_PRODUCT_URLS_LIMIT,
    preferred_host_url: str | None = None,
    used_items: list[dict[str, str | int]] | None = None,
    rossko_items: list[dict[str, str | int]] | None = None,
    export_date: date | None = None,
    created_new_batch: bool = False,
    pool_was_reset: bool = False,
) -> str:
    if used_items is None and rossko_items is None:
        used_items, rossko_items, export_date, created_new_batch, pool_was_reset = get_daily_seo_url_batch(
            db,
            limit=limit,
            preferred_host_url=preferred_host_url,
        )

    used_items = used_items or []
    rossko_items = rossko_items or []
    urls = [str(item["url"]) for item in used_items] + [str(item["url"]) for item in rossko_items]
    if not urls:
        return ""
    return "\n".join(urls) + "\n"


def _product_sitemap_url_block(
    loc: str,
    *,
    lastmod: date | None,
    priority: str,
) -> str:
    url_lines = [
        "  <url>",
        f"    <loc>{loc}</loc>",
    ]
    if lastmod is not None:
        url_lines.append(f"    <lastmod>{lastmod.isoformat()}</lastmod>")
    url_lines.extend(
        [
            "    <changefreq>weekly</changefreq>",
            f"    <priority>{priority}</priority>",
            "  </url>",
        ]
    )
    return "\n".join(url_lines)


def build_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    url_count = 0
    working_products: list = []
    article_counts: dict[str, int] = {}
    name_counts: dict[str, int] = {}

    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        working_products.append(product)
        article_key = normalize_partnumber(getattr(product, "article", None))
        if article_key:
            article_counts[article_key] = article_counts.get(article_key, 0) + 1
        name_key = str(getattr(product, "name", "") or "").strip().casefold()
        if name_key:
            name_counts[name_key] = name_counts.get(name_key, 0) + 1

    seen_urls: set[str] = set()

    for product in working_products:
        lastmod = _product_lastmod_date(product)
        part_priority = "0.8" if product.is_new else "0.85"
        lines.append(_product_sitemap_url_block(
            build_product_page_url(product, site_origin),
            lastmod=lastmod,
            priority=part_priority,
        ))
        url_count += 1

        article_key = normalize_partnumber(product.article)
        has_unique_article = bool(article_key and article_counts.get(article_key) == 1)
        added_search_url = False

        if has_unique_article:
            article_url = build_used_catalog_url_for_query(site_origin, article_key)
            if article_url not in seen_urls:
                seen_urls.add(article_url)
                lines.append(_product_sitemap_url_block(
                    article_url,
                    lastmod=lastmod,
                    priority="0.75",
                ))
                url_count += 1
                added_search_url = True

        if not added_search_url:
            canonical_used_url = build_product_used_catalog_url(product, site_origin)
            if canonical_used_url not in seen_urls:
                seen_urls.add(canonical_used_url)
                lines.append(_product_sitemap_url_block(
                    canonical_used_url,
                    lastmod=lastmod,
                    priority="0.75",
                ))
                url_count += 1

        name_key = str(product.name or "").strip().casefold()
        if name_key and name_counts.get(name_key) == 1:
            name_url = build_used_catalog_url_for_query(site_origin, str(product.name or "").strip())
            if name_url not in seen_urls:
                seen_urls.add(name_url)
                lines.append(_product_sitemap_url_block(
                    name_url,
                    lastmod=lastmod,
                    priority="0.7",
                ))
                url_count += 1

    lines.append("</urlset>")
    return "\n".join(lines) + "\n", url_count


def _new_part_card_lastmod(card: NewPartsSeoCard) -> str | None:
    if card.updated_at is None:
        return None
    ts = _as_utc_datetime(card.updated_at)
    return ts.date().isoformat() if ts is not None else None


def _new_part_sitemap_url_block(site_origin: str, card: NewPartsSeoCard) -> tuple[str, str]:
    loc = f"{site_origin.rstrip('/')}{build_new_part_card_path(int(card.id), card.brand, card.article)}"
    lastmod_date = _new_part_card_lastmod(card)
    lines = [
        "  <url>",
        f"    <loc>{loc}</loc>",
    ]
    if lastmod_date:
        lines.append(f"    <lastmod>{lastmod_date}</lastmod>")
    lines.extend(
        [
            "    <changefreq>weekly</changefreq>",
            "    <priority>0.75</priority>",
            "  </url>",
        ]
    )
    return loc, "\n".join(lines)


def append_new_part_card_to_sitemap_cache(
    db: Session,
    card: NewPartsSeoCard,
    *,
    preferred_host_url: str | None = None,
) -> bool:
    """
    Добавляет URL карточки в кэш sitemap-new-parts без пересборки products.
    Возвращает True, если URL добавлен или уже был в файле.
    """
    if not is_rossko_new_part_sitemap_eligible(card):
        return False

    site_origin = _resolve_origin(db, preferred_host_url)
    loc, entry = _new_part_sitemap_url_block(site_origin, card)
    ensure_new_parts_sitemap_pages_sized(db, preferred_host_url=preferred_host_url)
    row = get_new_parts_sitemap_cache_row(db)
    if row is None or not row.xml_content:
        rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
        return True

    if loc in (row.xml_content or ""):
        return True

    if "<sitemapindex" in row.xml_content:
        page_count = _count_new_parts_page_caches(db)
        if page_count <= 0:
            rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
            return True
        last_row = _get_sitemap_cache_row(db, _new_parts_page_cache_key(page_count))
        if (
            last_row is None
            or not last_row.xml_content
            or "</urlset>" not in last_row.xml_content
        ):
            rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
            return True
        if loc in last_row.xml_content:
            return True

        if int(last_row.url_count or 0) >= NEW_PARTS_SITEMAP_MAX_URLS:
            new_page = page_count + 1
            _persist_sitemap_cache(
                db,
                cache_key=_new_parts_page_cache_key(new_page),
                xml_content=_build_urlset_xml([entry]),
                url_count=1,
            )
            _persist_new_parts_sitemap_index(
                db,
                site_origin=site_origin,
                page_count=new_page,
                total_url_count=int(row.url_count or 0) + 1,
            )
            return True

        xml_content = last_row.xml_content.replace("</urlset>", f"{entry}\n</urlset>", 1)
        _persist_sitemap_cache(
            db,
            cache_key=_new_parts_page_cache_key(page_count),
            xml_content=xml_content,
            url_count=int(last_row.url_count or 0) + 1,
        )
        _persist_sitemap_cache(
            db,
            cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
            xml_content=row.xml_content,
            url_count=int(row.url_count or 0) + 1,
        )
        return True

    if int(row.url_count or 0) >= NEW_PARTS_SITEMAP_MAX_URLS:
        # Promote current single urlset to page 1 and start page 2.
        _persist_sitemap_cache(
            db,
            cache_key=_new_parts_page_cache_key(1),
            xml_content=row.xml_content,
            url_count=int(row.url_count or 0),
        )
        _persist_sitemap_cache(
            db,
            cache_key=_new_parts_page_cache_key(2),
            xml_content=_build_urlset_xml([entry]),
            url_count=1,
        )
        _persist_new_parts_sitemap_index(
            db,
            site_origin=site_origin,
            page_count=2,
            total_url_count=int(row.url_count or 0) + 1,
        )
        return True

    if "</urlset>" not in row.xml_content:
        rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
        return True

    xml_content = row.xml_content.replace("</urlset>", f"{entry}\n</urlset>", 1)
    _persist_sitemap_cache(
        db,
        cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=int(row.url_count or 0) + 1,
    )
    return True


def try_refresh_new_parts_sitemap_for_card(
    db: Session,
    card: NewPartsSeoCard,
    *,
    preferred_host_url: str | None = None,
) -> None:
    """Обновляет только sitemap-new-parts; ошибки не пробрасываются."""
    try:
        append_new_part_card_to_sitemap_cache(db, card, preferred_host_url=preferred_host_url)
    except Exception:
        logger.exception("Failed to refresh new parts sitemap for card id=%s", card.id)


def build_new_parts_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    entries = _collect_new_parts_sitemap_entries(db, preferred_host_url=preferred_host_url)
    return _build_urlset_xml(entries), len(entries)


def build_new_parts_sitemap_pages(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> tuple[list[tuple[str, int]], int]:
    entries = _collect_new_parts_sitemap_entries(db, preferred_host_url=preferred_host_url)
    if not entries:
        return [(_empty_urlset_xml(), 0)], 0
    pages: list[tuple[str, int]] = []
    for start in range(0, len(entries), NEW_PARTS_SITEMAP_MAX_URLS):
        chunk = entries[start:start + NEW_PARTS_SITEMAP_MAX_URLS]
        pages.append((_build_urlset_xml(chunk), len(chunk)))
    return pages, len(entries)


def build_new_brands_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    url_count = 0
    rows = (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == "brand_new",
            SeoLandingPage.is_active.is_(True),
        )
        .order_by(SeoLandingPage.priority.desc(), SeoLandingPage.slug.asc())
        .all()
    )
    for row in rows:
        loc = f"{site_origin}/autoparts/new/brand/{row.slug}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.8</priority>")
        lines.append("  </url>")
        url_count += 1
    lines.append("</urlset>")
    return "\n".join(lines) + "\n", url_count


def build_new_categories_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    url_count = 0
    rows = (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == "category_new",
            SeoLandingPage.is_active.is_(True),
        )
        .order_by(SeoLandingPage.priority.desc(), SeoLandingPage.slug.asc())
        .all()
    )
    for row in rows:
        loc = f"{site_origin}/autoparts/new/category/{row.slug}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.8</priority>")
        lines.append("  </url>")
        url_count += 1
    lines.append("</urlset>")
    return "\n".join(lines) + "\n", url_count


def _build_landing_kind_sitemap_xml(
    db: Session,
    *,
    kind: str,
    path_prefix: str,
    preferred_host_url: str | None = None,
) -> tuple[str, int]:
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    url_count = 0
    rows = (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == kind,
            SeoLandingPage.is_active.is_(True),
        )
        .order_by(SeoLandingPage.priority.desc(), SeoLandingPage.slug.asc())
        .all()
    )
    for row in rows:
        loc = f"{site_origin}{path_prefix}/{row.slug}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append("    <priority>0.8</priority>")
        lines.append("  </url>")
        url_count += 1
    lines.append("</urlset>")
    return "\n".join(lines) + "\n", url_count


def build_used_brands_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    return _build_landing_kind_sitemap_xml(
        db,
        kind="brand_used",
        path_prefix="/autoparts/used/brand",
        preferred_host_url=preferred_host_url,
    )


def build_used_categories_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    return _build_landing_kind_sitemap_xml(
        db,
        kind="category_used",
        path_prefix="/autoparts/used/category",
        preferred_host_url=preferred_host_url,
    )


def build_used_geo_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    return _build_landing_kind_sitemap_xml(
        db,
        kind="geo",
        path_prefix="/autoparts/used/geo",
        preferred_host_url=preferred_host_url,
    )


def _get_sitemap_cache_row(db: Session, cache_key: str) -> SeoSitemapCache | None:
    return (
        db.query(SeoSitemapCache)
        .filter(SeoSitemapCache.cache_key == cache_key)
        .first()
    )


def _snapshot_from_cache_row(row: SeoSitemapCache) -> SitemapCacheSnapshot:
    generated_at = _as_utc_datetime(row.generated_at) or datetime.now(timezone.utc)
    return SitemapCacheSnapshot(
        xml_content=row.xml_content,
        url_count=int(row.url_count or 0),
        generated_at=generated_at,
    )


def _persist_sitemap_cache(
    db: Session,
    *,
    cache_key: str,
    xml_content: str,
    url_count: int,
) -> SitemapCacheSnapshot:
    generated_at = datetime.now(timezone.utc)
    row = _get_sitemap_cache_row(db, cache_key)
    if row is None:
        row = SeoSitemapCache(
            cache_key=cache_key,
            xml_content=xml_content,
            url_count=url_count,
            generated_at=generated_at,
        )
        db.add(row)
    else:
        row.xml_content = xml_content
        row.url_count = url_count
        row.generated_at = generated_at
    db.commit()
    db.refresh(row)
    return _snapshot_from_cache_row(row)


def rebuild_products_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> ProductsSitemapSnapshot:
    xml_content, url_count = build_products_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=PRODUCTS_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_new_parts_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> NewPartsSitemapSnapshot:
    site_origin = _resolve_origin(db, preferred_host_url)
    pages, total_count = build_new_parts_sitemap_pages(db, preferred_host_url=preferred_host_url)
    generated_at = datetime.now(timezone.utc)

    if len(pages) <= 1:
        xml_content, url_count = pages[0] if pages else (_empty_urlset_xml(), 0)
        _delete_new_parts_page_caches(db, keep_pages=0)
        return _persist_sitemap_cache(
            db,
            cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
            xml_content=xml_content,
            url_count=url_count,
        )

    for page_num, (xml_content, url_count) in enumerate(pages, start=1):
        _persist_sitemap_cache(
            db,
            cache_key=_new_parts_page_cache_key(page_num),
            xml_content=xml_content,
            url_count=url_count,
        )
    _delete_new_parts_page_caches(db, keep_pages=len(pages))
    index_xml = _build_new_parts_sitemap_index_xml(
        site_origin,
        page_count=len(pages),
        generated_at=generated_at,
    )
    return _persist_sitemap_cache(
        db,
        cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
        xml_content=index_xml,
        url_count=total_count,
    )


def rebuild_new_brands_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    xml_content, url_count = build_new_brands_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=NEW_BRANDS_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_new_categories_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    xml_content, url_count = build_new_categories_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=NEW_CATEGORIES_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_used_brands_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    xml_content, url_count = build_used_brands_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=USED_BRANDS_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_used_categories_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    xml_content, url_count = build_used_categories_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=USED_CATEGORIES_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_used_geo_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    xml_content, url_count = build_used_geo_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=USED_GEO_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_all_sitemaps_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> tuple[ProductsSitemapSnapshot, NewPartsSitemapSnapshot, SitemapCacheSnapshot, SitemapCacheSnapshot]:
    products = rebuild_products_sitemap_cache(db, preferred_host_url=preferred_host_url)
    new_parts = rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
    new_brands = rebuild_new_brands_sitemap_cache(db, preferred_host_url=preferred_host_url)
    new_categories = rebuild_new_categories_sitemap_cache(db, preferred_host_url=preferred_host_url)
    rebuild_used_brands_sitemap_cache(db, preferred_host_url=preferred_host_url)
    rebuild_used_categories_sitemap_cache(db, preferred_host_url=preferred_host_url)
    rebuild_used_geo_sitemap_cache(db, preferred_host_url=preferred_host_url)
    return products, new_parts, new_brands, new_categories


def get_products_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, PRODUCTS_SITEMAP_CACHE_KEY)


def get_new_parts_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, NEW_PARTS_SITEMAP_CACHE_KEY)


def get_new_brands_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, NEW_BRANDS_SITEMAP_CACHE_KEY)


def get_new_categories_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, NEW_CATEGORIES_SITEMAP_CACHE_KEY)


def get_used_brands_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, USED_BRANDS_SITEMAP_CACHE_KEY)


def get_used_categories_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, USED_CATEGORIES_SITEMAP_CACHE_KEY)


def get_used_geo_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, USED_GEO_SITEMAP_CACHE_KEY)


def get_products_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> ProductsSitemapSnapshot:
    row = get_products_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_products_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_new_parts_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> NewPartsSitemapSnapshot:
    resized = ensure_new_parts_sitemap_pages_sized(db, preferred_host_url=preferred_host_url)
    if resized is not None:
        return resized

    row = get_new_parts_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        if (
            "<sitemapindex" not in row.xml_content
            and int(row.url_count or 0) > NEW_PARTS_SITEMAP_MAX_URLS
        ):
            return rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
        return _snapshot_from_cache_row(row)
    return rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_new_parts_sitemap_page_snapshot(
    db: Session,
    page: int,
    *,
    preferred_host_url: str | None = None,
) -> NewPartsSitemapSnapshot:
    if page < 1:
        raise ValueError("page must be >= 1")

    ensure_new_parts_sitemap_pages_sized(db, preferred_host_url=preferred_host_url)

    page_row = _get_sitemap_cache_row(db, _new_parts_page_cache_key(page))
    if page_row is not None and page_row.xml_content:
        return _snapshot_from_cache_row(page_row)

    row = get_new_parts_sitemap_cache_row(db)
    if row is not None and row.xml_content and "<sitemapindex" not in row.xml_content:
        if page != 1:
            raise ValueError("new parts sitemap is not paginated")
        return _snapshot_from_cache_row(row)

    # Missing page: avoid synchronous full rebuild (minutes / proxy timeouts).
    # Daily Celery rebuild / admin SEO rebuild will restore pages.
    raise ValueError(f"new parts sitemap page {page} not found")


def get_new_brands_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    row = get_new_brands_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_new_brands_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_new_categories_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    row = get_new_categories_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_new_categories_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_used_brands_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    row = get_used_brands_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_used_brands_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_used_categories_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    row = get_used_categories_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_used_categories_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_used_geo_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> SitemapCacheSnapshot:
    row = get_used_geo_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_used_geo_sitemap_cache(db, preferred_host_url=preferred_host_url)


def _sitemap_cache_meta(row: SeoSitemapCache | None) -> dict[str, object]:
    generated_at = _as_utc_datetime(row.generated_at) if row else None
    return {
        "generated_at": generated_at.isoformat() if generated_at else None,
        "url_count": int(row.url_count or 0) if row else 0,
        "is_stale": is_sitemap_cache_stale(generated_at),
    }


def get_products_sitemap_cache_meta(db: Session) -> dict[str, object]:
    return _sitemap_cache_meta(get_products_sitemap_cache_row(db))


def get_new_parts_sitemap_cache_meta(db: Session) -> dict[str, object]:
    return _sitemap_cache_meta(get_new_parts_sitemap_cache_row(db))


def get_new_brands_sitemap_cache_meta(db: Session) -> dict[str, object]:
    return _sitemap_cache_meta(get_new_brands_sitemap_cache_row(db))


def get_new_categories_sitemap_cache_meta(db: Session) -> dict[str, object]:
    return _sitemap_cache_meta(get_new_categories_sitemap_cache_row(db))


def latest_sitemap_generated_at(*values: datetime | None) -> datetime | None:
    latest: datetime | None = None
    for value in values:
        ts = _as_utc_datetime(value)
        if ts is None:
            continue
        if latest is None or ts > latest:
            latest = ts
    return latest


def build_fallback_sitemap_index_xml(
    site_origin: str,
    *,
    pages_lastmod: str | None = None,
) -> str:
    """Minimal sitemap index when products cache is unavailable."""
    origin = site_origin.rstrip("/")
    pages_mod = (pages_lastmod or settings.SITEMAP_PAGES_LASTMOD).strip()
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "  <sitemap>\n"
        f"    <loc>{origin}/sitemap-pages.xml</loc>\n"
        f"    <lastmod>{pages_mod}</lastmod>\n"
        "  </sitemap>\n"
        "</sitemapindex>\n"
    )


def _sitemap_index_lastmod_line(generated_at: datetime | None) -> str:
    ts = _as_utc_datetime(generated_at)
    if ts is None:
        return ""
    return f"    <lastmod>{ts.date().isoformat()}</lastmod>\n"


def build_sitemap_index_xml(
    site_origin: str,
    *,
    products_generated_at: datetime | None,
    new_parts_generated_at: datetime | None = None,
    new_brands_generated_at: datetime | None = None,
    new_categories_generated_at: datetime | None = None,
    used_brands_generated_at: datetime | None = None,
    used_categories_generated_at: datetime | None = None,
    used_geo_generated_at: datetime | None = None,
    pages_lastmod: str | None = None,
) -> str:
    origin = site_origin.rstrip("/")
    pages_mod = (pages_lastmod or settings.SITEMAP_PAGES_LASTMOD).strip()
    products_mod = _sitemap_index_lastmod_line(products_generated_at)
    new_parts_mod = _sitemap_index_lastmod_line(new_parts_generated_at)
    new_brands_mod = _sitemap_index_lastmod_line(new_brands_generated_at)
    new_categories_mod = _sitemap_index_lastmod_line(new_categories_generated_at)
    used_brands_mod = _sitemap_index_lastmod_line(used_brands_generated_at)
    used_categories_mod = _sitemap_index_lastmod_line(used_categories_generated_at)
    used_geo_mod = _sitemap_index_lastmod_line(used_geo_generated_at)

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "  <sitemap>\n"
        f"    <loc>{origin}/sitemap-pages.xml</loc>\n"
        f"    <lastmod>{pages_mod}</lastmod>\n"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-products.xml</loc>\n"
        f"{products_mod}"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-new-parts.xml</loc>\n"
        f"{new_parts_mod}"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-new-brands.xml</loc>\n"
        f"{new_brands_mod}"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-new-categories.xml</loc>\n"
        f"{new_categories_mod}"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-used-brands.xml</loc>\n"
        f"{used_brands_mod}"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-used-categories.xml</loc>\n"
        f"{used_categories_mod}"
        "  </sitemap>\n"
        "  <sitemap>\n"
        f"    <loc>{origin}/api/feeds/sitemap-used-geo.xml</loc>\n"
        f"{used_geo_mod}"
        "  </sitemap>\n"
        "</sitemapindex>\n"
    )


def generate_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    """Backward-compatible alias: returns cached snapshot XML."""
    return get_products_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content


def generate_new_parts_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    return get_new_parts_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content


def generate_new_brands_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    return get_new_brands_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content


def generate_new_categories_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    return get_new_categories_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content
