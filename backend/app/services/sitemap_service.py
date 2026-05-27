from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.models.product import Product as ProductModel
from app.models.seo_product_url_export import SeoProductUrlExport
from app.services.yandex_feed_xml_service import _iter_catalog_products, _resolve_site_origin
from app.utils.product_urls import build_product_page_url
from app.utils.yandex_integration_db import get_or_create_yandex_integration
from app.services.public_user_profile_service import (
    count_public_user_profiles,
    iter_public_profile_urls,
)

DEFAULT_PRODUCT_URLS_LIMIT = 150


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
    org_count = count_public_organizations(db)
    product_count = count_working_catalog_products(db)
    profile_count = count_public_user_profiles(db)
    static_pages_count = 10

    return [
        {
            "id": "index",
            "title": "Индекс sitemap",
            "description": "Корневой файл со списком всех sitemap сайта",
            "url": f"{site_origin}/sitemap.xml",
            "type": "index",
            "url_count": 4,
            "location": "frontend/public",
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
        {
            "id": "organizations",
            "title": "Организации",
            "description": "Публичные страницы зарегистрированных организаций",
            "url": f"{site_origin}/api/feeds/sitemap-organizations.xml",
            "type": "dynamic",
            "url_count": org_count,
            "location": "backend",
        },
        {
            "id": "profiles",
            "title": "Профили продавцов и покупателей",
            "description": "Публичные страницы пользователей по ID",
            "url": f"{site_origin}/api/feeds/sitemap-profiles.xml",
            "type": "dynamic",
            "url_count": profile_count,
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


def generate_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    site_origin = _resolve_origin(db, preferred_host_url)
    # В sitemap-products.xml иногда важно наличие lastmod для более предсказуемого переобхода.
    # Так как у Product нет отдельного updated_at, используем дату формирования sitemap (UTC).
    today = _export_date_today()
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        loc = build_product_page_url(product, site_origin)
        priority = "0.8" if product.is_new else "0.85"
        lines.extend(
            [
                "  <url>",
                f"    <loc>{loc}</loc>",
                f"    <lastmod>{today.isoformat()}</lastmod>",
                "    <changefreq>weekly</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


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
