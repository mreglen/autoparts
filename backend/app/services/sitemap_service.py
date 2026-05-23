from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.services.yandex_feed_xml_service import _iter_catalog_products, _resolve_site_origin
from app.utils.product_urls import build_product_page_url
from app.utils.yandex_integration_db import get_or_create_yandex_integration

DEFAULT_PRODUCT_URLS_LIMIT = 150


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


def collect_working_product_urls(
    db: Session,
    *,
    limit: int = DEFAULT_PRODUCT_URLS_LIMIT,
    preferred_host_url: str | None = None,
) -> list[dict[str, str | int]]:
    site_origin = _resolve_origin(db, preferred_host_url)
    items: list[dict[str, str | int]] = []

    for product in _iter_catalog_products(db):
        if not is_working_catalog_product(product):
            continue
        items.append(
            {
                "id": int(product.id),
                "brand": str(product.brand or "").strip(),
                "article": str(product.article or "").strip(),
                "name": str(product.name or "").strip(),
                "url": build_product_page_url(product, site_origin),
            }
        )
        if len(items) >= limit:
            break

    return items


def generate_product_urls_text_file(
    db: Session,
    *,
    limit: int = DEFAULT_PRODUCT_URLS_LIMIT,
    preferred_host_url: str | None = None,
) -> str:
    items = collect_working_product_urls(
        db,
        limit=limit,
        preferred_host_url=preferred_host_url,
    )
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        "# Карточки товаров «Свой Гараж» — рабочие URL",
        "# Критерии: товар в наличии, есть фото, заполнены бренд, артикул и название",
        f"# Сгенерировано: {generated_at}",
        f"# Запрошено: {limit}, найдено: {len(items)}",
        "",
    ]
    lines.extend(item["url"] for item in items)
    return "\n".join(lines) + "\n"


def generate_products_sitemap_xml(db: Session, *, preferred_host_url: str | None = None) -> str:
    site_origin = _resolve_origin(db, preferred_host_url)
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
                "    <changefreq>weekly</changefreq>",
                f"    <priority>{priority}</priority>",
                "  </url>",
            ]
        )

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"
