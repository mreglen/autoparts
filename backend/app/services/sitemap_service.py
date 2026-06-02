from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.product import Product as ProductModel
from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.seo_product_url_export import SeoProductUrlExport
from app.models.seo_sitemap_cache import SeoSitemapCache
from app.services.new_parts_seo_card_service import (
    build_new_part_card_path,
    count_rossko_new_part_cards_for_sitemap,
    is_rossko_new_part_sitemap_eligible,
    iter_rossko_new_part_cards_for_sitemap,
)
from app.services.yandex_feed_xml_service import _iter_catalog_products, _resolve_site_origin
from app.utils.product_urls import build_product_page_url
from app.utils.yandex_integration_db import get_or_create_yandex_integration
from app.services.public_user_profile_service import (
    count_public_user_profiles,
    iter_public_profile_urls,
)

DEFAULT_PRODUCT_URLS_LIMIT = 150
PRODUCTS_SITEMAP_CACHE_KEY = "products"
NEW_PARTS_SITEMAP_CACHE_KEY = "new_parts"
SITEMAP_CACHE_MAX_AGE_SECONDS = 86400

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class SitemapCacheSnapshot:
    xml_content: str
    url_count: int
    generated_at: datetime


ProductsSitemapSnapshot = SitemapCacheSnapshot
NewPartsSitemapSnapshot = SitemapCacheSnapshot


def build_organization_page_url(org_id: str, site_origin: str) -> str:
    return f"{site_origin.rstrip('/')}/organizations/{org_id}"


def count_working_catalog_products(db: Session) -> int:
    count = 0
    for product in _iter_catalog_products(db):
        if is_working_catalog_product(product):
            count += 1
    return count


def count_public_organizations(db: Session) -> int:
    from app.models.organization import Organization as OrganizationModel

    return db.query(OrganizationModel).count()


def count_active_new_part_cards(db: Session) -> int:
    return count_rossko_new_part_cards_for_sitemap(db)


def get_site_sitemap_files(db: Session, *, preferred_host_url: str | None = None) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    product_count = count_working_catalog_products(db)
    new_parts_count = count_active_new_part_cards(db)
    static_pages_count = 10

    return [
        {
            "id": "index",
            "title": "Индекс sitemap",
            "description": "Корневой файл со списком всех sitemap сайта",
            "url": f"{site_origin}/sitemap.xml",
            "type": "index",
            "url_count": 3,
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
            "id": "admin-analytics",
            "title": "Админ-страница аналитики",
            "description": "Маршрут панели администратора для SEO/аналитики",
            "url": f"{site_origin}/admin/analytics",
            "type": "admin",
            "url_count": 1,
            "location": "frontend",
        },
    ]


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


def _exported_product_ids(db: Session) -> set[int]:
    rows = db.query(SeoProductUrlExport.product_id).all()
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


def get_daily_product_url_batch(
    db: Session,
    *,
    limit: int = DEFAULT_PRODUCT_URLS_LIMIT,
    preferred_host_url: str | None = None,
) -> tuple[list[dict[str, str | int]], date, bool, bool]:
    """
    Возвращает суточную порцию URL (до limit шт.).

    - В течение календарных суток (UTC) повторный запрос отдаёт тот же список.
    - На следующий день формируется новая порция без ранее выгруженных товаров.
    - Когда все подходящие товары уже были в выгрузках, пул сбрасывается и цикл начинается заново.

    Returns: (items, export_date, created_new_batch, pool_was_reset)
    """
    today = _export_date_today()
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
        return items, today, False, False

    excluded = _exported_product_ids(db)
    items = collect_working_product_urls(
        db,
        limit=limit,
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
            limit=limit,
            preferred_host_url=preferred_host_url,
            exclude_product_ids=set(),
        )

    if not items:
        return [], today, False, pool_reset

    now = datetime.now(timezone.utc)
    for item in items:
        db.add(
            SeoProductUrlExport(
                product_id=int(item["id"]),
                export_date=today,
                exported_at=now,
            )
        )
    db.commit()

    return items, today, True, pool_reset


def generate_product_urls_text_file(
    db: Session,
    *,
    limit: int = DEFAULT_PRODUCT_URLS_LIMIT,
    preferred_host_url: str | None = None,
    items: list[dict[str, str | int]] | None = None,
    export_date: date | None = None,
    created_new_batch: bool = False,
    pool_was_reset: bool = False,
) -> str:
    if items is None:
        items, export_date, created_new_batch, pool_was_reset = get_daily_product_url_batch(
            db,
            limit=limit,
            preferred_host_url=preferred_host_url,
        )

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    batch_date = export_date or _export_date_today()
    lines = [
        "# Карточки товаров «Свой Гараж» — рабочие URL",
        "# Критерии: товар в наличии, есть фото, заполнены бренд, артикул и название",
        f"# Дата суточной порции (UTC): {batch_date.isoformat()}",
        f"# Сгенерировано: {generated_at}",
        f"# Запрошено: {limit}, в файле: {len(items)}",
    ]
    if created_new_batch:
        lines.append("# Новая суточная порция (ранее не выгружались)")
    else:
        lines.append("# Повторная выгрузка сегодняшней порции")
    if pool_was_reset:
        lines.append("# Все товары уже были в прошлых выгрузках — пул сброшен, список начат заново")
    lines.append("")
    lines.extend(item["url"] for item in items)
    return "\n".join(lines) + "\n"


def build_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> tuple[str, int]:
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    url_count = 0

    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        loc = build_product_page_url(product, site_origin)
        priority = "0.8" if product.is_new else "0.85"
        lastmod = _product_lastmod_date(product)
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
        lines.extend(url_lines)
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
    row = get_new_parts_sitemap_cache_row(db)
    if row is None or not row.xml_content or "</urlset>" not in row.xml_content:
        rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
        return True

    if loc in row.xml_content:
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
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    url_count = 0

    for card in iter_rossko_new_part_cards_for_sitemap(db):
        _loc, entry = _new_part_sitemap_url_block(site_origin, card)
        lines.append(entry)
        url_count += 1

    lines.append("</urlset>")
    return "\n".join(lines) + "\n", url_count


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
    xml_content, url_count = build_new_parts_sitemap_xml(db, preferred_host_url=preferred_host_url)
    return _persist_sitemap_cache(
        db,
        cache_key=NEW_PARTS_SITEMAP_CACHE_KEY,
        xml_content=xml_content,
        url_count=url_count,
    )


def rebuild_all_sitemaps_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> tuple[ProductsSitemapSnapshot, NewPartsSitemapSnapshot]:
    products = rebuild_products_sitemap_cache(db, preferred_host_url=preferred_host_url)
    new_parts = rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)
    return products, new_parts


def get_products_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, PRODUCTS_SITEMAP_CACHE_KEY)


def get_new_parts_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return _get_sitemap_cache_row(db, NEW_PARTS_SITEMAP_CACHE_KEY)


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
    row = get_new_parts_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return _snapshot_from_cache_row(row)
    return rebuild_new_parts_sitemap_cache(db, preferred_host_url=preferred_host_url)


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
    pages_lastmod: str | None = None,
) -> str:
    origin = site_origin.rstrip("/")
    pages_mod = (pages_lastmod or settings.SITEMAP_PAGES_LASTMOD).strip()
    products_mod = _sitemap_index_lastmod_line(products_generated_at)
    new_parts_mod = _sitemap_index_lastmod_line(new_parts_generated_at)

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
        "</sitemapindex>\n"
    )


def generate_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    """Backward-compatible alias: returns cached snapshot XML."""
    return get_products_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content


def generate_new_parts_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    return get_new_parts_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content


def generate_organizations_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    from app.models.organization import Organization as OrganizationModel

    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        "  <url>",
        f"    <loc>{site_origin.rstrip('/')}/organizations</loc>",
        "    <changefreq>weekly</changefreq>",
        "    <priority>0.75</priority>",
        "  </url>",
    ]

    orgs = (
        db.query(OrganizationModel)
        .order_by(OrganizationModel.name.asc(), OrganizationModel.id.asc())
        .all()
    )
    for org in orgs:
        loc = build_organization_page_url(org.id, site_origin)
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                "    <changefreq>weekly</changefreq>",
                "    <priority>0.7</priority>",
                "  </url>",
            ]
        )

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def generate_profiles_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    site_origin = _resolve_origin(db, preferred_host_url)
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    for loc, priority in iter_public_profile_urls(db, site_origin):
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                "    <changefreq>monthly</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"
