from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.services.spa_page_check_service import PART_PATH_RE, _normalize_path
from app.services.yandex_feed_xml_service import _absolute_photo_url, _resolve_site_origin
from app.utils.page_keywords import build_page_keywords
from app.utils.product_display_name import extract_product_description, format_product_display_title
from app.utils.product_json_ld import (
    build_catalog_product_json_ld,
    dumps_json_ld,
    product_body_description,
)
from app.utils.product_search_seo import (
    build_product_search_description,
    build_product_search_title,
    build_product_seo_summary,
    resolve_product_city,
)
from app.utils.product_urls import build_product_page_url, build_product_used_catalog_url
from app.utils.seo_constants import resolve_default_og_image_url


@dataclass(frozen=True)
class ProductSeoMeta:
    title: str
    description: str
    canonical_url: str
    h1: str
    image_url: str | None
    price: str | None
    in_stock: bool
    json_ld: str
    json_ld_graph: str
    keywords: str = ""
    seo_summary: str = ""
    body_description: str | None = None
    used_catalog_url: str = ""
    used_catalog_path: str = ""
    brand: str = ""
    article: str = ""
    city: str = ""
    condition_label: str = ""


def _strip_html(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()



def parse_part_path_product_id(path: str) -> int | None:
    normalized = _normalize_path(unquote((path or "").strip()))
    match = PART_PATH_RE.match(normalized)
    if not match:
        return None
    try:
        return int(match.group("product_id"))
    except (TypeError, ValueError):
        return None


def _load_product(db: Session, product_id: int) -> ProductModel | None:
    return (
        db.query(ProductModel)
        .options(
            selectinload(ProductModel.photos),
            selectinload(ProductModel.organization),
            selectinload(ProductModel.part_type),
        )
        .filter(ProductModel.id == product_id, ProductModel.quantity > 0)
        .first()
    )


def build_product_seo_meta(product: ProductModel, *, site_origin: str | None = None) -> ProductSeoMeta:
    origin = _resolve_site_origin(site_origin)
    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    name = format_product_display_title(brand, article, product.name)
    short_name = extract_product_description(product.name, brand, article)
    canonical_url = build_product_page_url(product, origin)

    organization = getattr(product, "organization", None)
    org_address = getattr(organization, "address", None) if organization else None
    org_name_raw = getattr(organization, "name", None) if organization else None
    org_name = org_name_raw.strip() if isinstance(org_name_raw, str) and org_name_raw.strip() else None
    org_phone_raw = getattr(organization, "phone", None) if organization else None
    org_phone = org_phone_raw.strip() if isinstance(org_phone_raw, str) and org_phone_raw.strip() else None
    city = resolve_product_city(organization_address=str(org_address) if org_address is not None else None)

    title = build_product_search_title(
        brand=brand,
        article=article,
        product_name=product.name,
        seller_name=org_name,
        listing_id=int(product.id),
    )

    unique_desc = _strip_html(product.description)
    in_stock = (product.quantity or 0) > 0

    price = None
    if product.price is not None:
        try:
            price = f"{float(product.price):.2f}"
        except (TypeError, ValueError):
            price = str(product.price)

    description = build_product_search_description(
        brand=brand,
        article=article,
        is_new=bool(product.is_new),
        city=city,
        price=product.price,
        in_stock=in_stock,
        short_name=short_name,
        unique_description=unique_desc,
        seller_name=org_name,
        listing_id=int(product.id),
    )

    image_url = None
    for photo in product.photos or []:
        raw_url = getattr(photo, "photo_url", None)
        if not raw_url:
            continue
        path = raw_url
        if not str(raw_url).startswith(("http://", "https://")):
            path = photo.full_url if hasattr(photo, "full_url") else raw_url
        image_url = _absolute_photo_url(path, origin)
        if image_url:
            break
    if not image_url:
        image_url = resolve_default_og_image_url(origin)

    product_json_ld = build_catalog_product_json_ld(
        product,
        site_origin=origin,
        canonical_url=canonical_url,
        city=city,
    )
    json_ld = dumps_json_ld(product_json_ld)
    json_ld_graph = build_product_json_ld_graph(
        json_ld=json_ld,
        canonical_url=canonical_url,
        h1=name,
        title=title,
        description=description,
    )
    body_description = product_body_description(
        brand=brand,
        article=article,
        name=name,
        unique_description=unique_desc,
        short_name=short_name,
        is_new=bool(product.is_new),
    )
    seo_summary = build_product_seo_summary(
        brand=brand,
        article=article,
        name=name,
        is_new=bool(product.is_new),
        city=city,
        price=product.price,
        in_stock=in_stock,
        short_name=short_name,
        unique_description=unique_desc,
    )
    used_catalog_url = build_product_used_catalog_url(product, origin)
    parsed_catalog = urlparse(used_catalog_url)
    used_catalog_path = parsed_catalog.path
    if parsed_catalog.query:
        used_catalog_path = f"{used_catalog_path}?{parsed_catalog.query}"
    condition_label = "Новая" if product.is_new else "Б/у"

    return ProductSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1=name,
        image_url=image_url,
        price=price,
        in_stock=in_stock,
        json_ld=json_ld,
        json_ld_graph=json_ld_graph,
        keywords=build_page_keywords(
            "product_used",
            brand=brand,
            article=article,
            city=city,
        ),
        seo_summary=seo_summary,
        body_description=body_description,
        used_catalog_url=used_catalog_url,
        used_catalog_path=used_catalog_path,
        brand=brand,
        article=article,
        city=city,
        condition_label=condition_label,
    )


def build_product_json_ld_graph(
    *,
    json_ld: str,
    canonical_url: str,
    h1: str,
    title: str | None = None,
    description: str | None = None,
) -> str:
    """Product + BreadcrumbList + WebPage для JSON-LD (Яндекс.Вебмастер, Google)."""
    product_obj = None
    if json_ld:
        try:
            parsed = json.loads(json_ld)
            if isinstance(parsed, dict) and parsed.get("@type") == "Product":
                product_obj = dict(parsed)
                product_obj.pop("@context", None)
                product_obj.setdefault("@id", f"{canonical_url}#product")
        except Exception:
            product_obj = None

    site_origin = canonical_url.split("/part/")[0]
    breadcrumb_obj = {
        "@type": "BreadcrumbList",
        "@id": f"{canonical_url}#breadcrumb",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Свой Гараж",
                "item": site_origin,
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Б/у запчасти",
                "item": f"{site_origin}/autoparts/used",
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": h1,
                "item": canonical_url,
            },
        ],
    }

    graph: list[dict] = []
    if product_obj:
        graph.append(product_obj)
    graph.append(breadcrumb_obj)
    if product_obj:
        graph.append(
            {
                "@type": "WebPage",
                "@id": f"{canonical_url}#webpage",
                "url": canonical_url,
                "name": title or h1,
                "description": description,
                "isPartOf": {
                    "@type": "WebSite",
                    "name": "Свой Гараж",
                    "url": site_origin,
                },
                "breadcrumb": {"@id": f"{canonical_url}#breadcrumb"},
                "mainEntity": {"@id": f"{canonical_url}#product"},
            }
        )

    if len(graph) == 1:
        graph_obj = {"@context": "https://schema.org", **graph[0]}
    else:
        graph_obj = {"@context": "https://schema.org", "@graph": graph}

    return json.dumps(graph_obj, ensure_ascii=False)


def get_product_seo_for_path(db: Session, raw_path: str) -> ProductSeoMeta | None:
    product_id = parse_part_path_product_id(raw_path)
    if product_id is None:
        return None
    product = _load_product(db, product_id)
    if product is None:
        return None
    return build_product_seo_meta(product)


def render_product_prerender_html(meta: ProductSeoMeta) -> str:
    title = html.escape(meta.title, quote=True)
    description = html.escape(meta.description, quote=True)
    canonical = html.escape(meta.canonical_url, quote=True)
    h1 = html.escape(meta.h1)
    body_desc = html.escape(meta.seo_summary or meta.body_description or meta.description)
    image_tag = (
        f'<meta property="og:image" content="{html.escape(meta.image_url, quote=True)}" />'
        if meta.image_url
        else ""
    )
    image_block = ""
    if meta.image_url:
        image_block = f'\n    <img src="{html.escape(meta.image_url, quote=True)}" alt="{h1}" />'
    json_ld_graph = meta.json_ld_graph or build_product_json_ld_graph(
        json_ld=meta.json_ld,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        title=meta.title,
        description=meta.description,
    )
    keywords_tag = ""
    if meta.keywords:
        keywords_tag = (
            f'  <meta name="keywords" content="{html.escape(meta.keywords, quote=True)}" />\n'
        )
    robots = html.escape("index, follow", quote=True)
    site_origin = meta.canonical_url.split("/part/")[0]
    used_catalog_link = ""
    if meta.used_catalog_url:
        used_catalog_link = (
            f'    <p><a href="{html.escape(meta.used_catalog_url, quote=True)}">'
            f"Каталог по артикулу {html.escape(meta.brand)} {html.escape(meta.article)}</a></p>\n"
        )
    details_html = ""
    if meta.brand or meta.article or meta.price:
        brand_row = (
            f"<dt>Бренд</dt><dd>{html.escape(meta.brand)}</dd>"
            if meta.brand
            else ""
        )
        article_row = (
            f"<dt>Артикул</dt><dd>{html.escape(meta.article)}</dd>"
            if meta.article
            else ""
        )
        price_row = (
            f"<dt>Цена</dt><dd>{html.escape(meta.price)} ₽</dd>"
            if meta.price
            else ""
        )
        city_row = (
            f"<dt>Город</dt><dd>{html.escape(meta.city)}</dd>"
            if meta.city
            else ""
        )
        condition_row = (
            f"<dt>Состояние</dt><dd>{html.escape(meta.condition_label)}</dd>"
            if meta.condition_label
            else ""
        )
        details_html = (
            f"    <dl>{brand_row}{article_row}{price_row}{city_row}{condition_row}</dl>\n"
        )
    breadcrumb_html = (
        "  <nav aria-label=\"Хлебные крошки\">\n"
        f'    <a href="{html.escape(site_origin, quote=True)}">Главная</a> ›\n'
        f'    <a href="{html.escape(site_origin, quote=True)}/autoparts/used">Б/у запчасти</a> ›\n'
        f"    <span>{h1}</span>\n"
        "  </nav>\n"
    )

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="{robots}" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
{keywords_tag}  <link rel="canonical" href="{canonical}" />
  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Свой Гараж" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:locale" content="ru_RU" />
  {image_tag}
  <script type="application/ld+json">{json_ld_graph}</script>
</head>
<body>
{breadcrumb_html}  <article>
    <h1>{h1}</h1>{image_block}
    <p>{body_desc}</p>
{details_html}{used_catalog_link}  </article>
</body>
</html>
"""
