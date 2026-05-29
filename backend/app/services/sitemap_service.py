from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.product import Product as ProductModel
from app.models.seo_product_url_export import SeoProductUrlExport
from app.models.seo_sitemap_cache import SeoSitemapCache
from app.services.yandex_feed_xml_service import _iter_catalog_products, _resolve_site_origin
from app.utils.product_urls import build_product_page_url
from app.utils.yandex_integration_db import get_or_create_yandex_integration
from app.services.public_user_profile_service import (
    count_public_user_profiles,
    iter_public_profile_urls,
)

DEFAULT_PRODUCT_URLS_LIMIT = 150
PRODUCTS_SITEMAP_CACHE_KEY = "products"
SITEMAP_CACHE_MAX_AGE_SECONDS = 86400


@dataclass(frozen=True)
class ProductsSitemapSnapshot:
    xml_content: str
    url_count: int
    generated_at: datetime


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


def get_site_sitemap_files(db: Session, *, preferred_host_url: str | None = None) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    product_count = count_working_catalog_products(db)
    static_pages_count = 10

    return [
        {
            "id": "index",
            "title": "Индекс sitemap",
            "description": "Корневой файл со списком всех sitemap сайта",
            "url": f"{site_origin}/sitemap.xml",
            "type": "index",
            "url_count": 2,
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
            "description": "Рабочие карточки товаров в наличии с фото и заполненными полями",
            "url": f"{site_origin}/api/feeds/sitemap-products.xml",
            "type": "dynamic",
            "url_count": product_count,
            "location": "backend",
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


def rebuild_products_sitemap_cache(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> ProductsSitemapSnapshot:
    xml_content, url_count = build_products_sitemap_xml(db, preferred_host_url=preferred_host_url)
    generated_at = datetime.now(timezone.utc)

    row = (
        db.query(SeoSitemapCache)
        .filter(SeoSitemapCache.cache_key == PRODUCTS_SITEMAP_CACHE_KEY)
        .first()
    )
    if row is None:
        row = SeoSitemapCache(
            cache_key=PRODUCTS_SITEMAP_CACHE_KEY,
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

    return ProductsSitemapSnapshot(
        xml_content=row.xml_content,
        url_count=int(row.url_count or 0),
        generated_at=_as_utc_datetime(row.generated_at) or generated_at,
    )


def get_products_sitemap_cache_row(db: Session) -> SeoSitemapCache | None:
    return (
        db.query(SeoSitemapCache)
        .filter(SeoSitemapCache.cache_key == PRODUCTS_SITEMAP_CACHE_KEY)
        .first()
    )


def get_products_sitemap_snapshot(
    db: Session,
    *,
    preferred_host_url: str | None = None,
) -> ProductsSitemapSnapshot:
    row = get_products_sitemap_cache_row(db)
    if row is not None and row.xml_content:
        return ProductsSitemapSnapshot(
            xml_content=row.xml_content,
            url_count=int(row.url_count or 0),
            generated_at=_as_utc_datetime(row.generated_at) or datetime.now(timezone.utc),
        )
    return rebuild_products_sitemap_cache(db, preferred_host_url=preferred_host_url)


def get_products_sitemap_cache_meta(db: Session) -> dict[str, object]:
    row = get_products_sitemap_cache_row(db)
    generated_at = _as_utc_datetime(row.generated_at) if row else None
    return {
        "generated_at": generated_at.isoformat() if generated_at else None,
        "url_count": int(row.url_count or 0) if row else 0,
        "is_stale": is_sitemap_cache_stale(generated_at),
    }


def build_sitemap_index_xml(
    site_origin: str,
    *,
    products_generated_at: datetime | None,
    pages_lastmod: str | None = None,
) -> str:
    origin = site_origin.rstrip("/")
    pages_mod = (pages_lastmod or settings.SITEMAP_PAGES_LASTMOD).strip()
    products_mod = ""
    if products_generated_at is not None:
        ts = _as_utc_datetime(products_generated_at)
        if ts is not None:
            products_mod = f"    <lastmod>{ts.date().isoformat()}</lastmod>\n"

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
        "</sitemapindex>\n"
    )


def generate_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    """Backward-compatible alias: returns cached snapshot XML."""
    return get_products_sitemap_snapshot(db, preferred_host_url=preferred_host_url).xml_content


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
