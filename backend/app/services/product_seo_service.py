from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from urllib.parse import unquote

from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.services.spa_page_check_service import PART_PATH_RE, _normalize_path
from app.services.yandex_feed_xml_service import _absolute_photo_url, _resolve_site_origin
from app.utils.product_display_name import extract_product_description, format_product_display_title
from app.utils.product_search_seo import (
    build_product_alternate_names,
    build_product_offer_json_ld,
    build_product_search_description,
    build_product_search_title,
    resolve_product_city,
)
from app.utils.product_urls import build_product_page_url
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
    product_description: str | None = None


def _strip_html(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def _body_product_description(unique_desc: str | None, meta_description: str, *, max_len: int = 500) -> str | None:
    text = re.sub(r"\s+", " ", (unique_desc or "")).strip()
    if not text or len(text) < 20:
        return None
    if text in meta_description:
        return None
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1].strip()}…"


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
    title = build_product_search_title(
        brand=brand,
        article=article,
        fallback_display_name=name,
    )

    organization = getattr(product, "organization", None)
    org_address = getattr(organization, "address", None) if organization else None
    org_name = getattr(organization, "name", None) if organization else None
    org_phone = getattr(organization, "phone", None) if organization else None
    city = resolve_product_city(organization_address=str(org_address) if org_address is not None else None)

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

    offer = build_product_offer_json_ld(
        canonical_url=canonical_url,
        price=price,
        in_stock=in_stock,
        is_new=bool(product.is_new),
        seller_name=str(org_name) if org_name is not None else None,
        seller_phone=str(org_phone) if org_phone is not None else None,
        seller_address=str(org_address) if org_address is not None else None,
        city=city,
    )

    alternate_names = build_product_alternate_names(brand=brand, article=article)
    json_ld_obj = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "sku": article or None,
        "mpn": article or None,
        "alternateName": alternate_names or None,
        "description": description,
        "brand": {"@type": "Brand", "name": brand} if brand else None,
        "image": [image_url] if image_url else None,
        "offers": offer,
    }
    json_ld_obj = {k: v for k, v in json_ld_obj.items() if v is not None}
    json_ld = json.dumps(json_ld_obj, ensure_ascii=False)

    return ProductSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical_url,
        h1=name,
        image_url=image_url,
        price=price,
        in_stock=in_stock,
        json_ld=json_ld,
        product_description=_body_product_description(unique_desc, description),
    )


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
    body_desc = html.escape(meta.description)
    product_desc_block = ""
    if meta.product_description:
        product_desc_block = f"\n    <p>{html.escape(meta.product_description)}</p>"
    image_tag = (
        f'<meta property="og:image" content="{html.escape(meta.image_url, quote=True)}" />'
        if meta.image_url
        else ""
    )
    try:
        product_obj = json.loads(meta.json_ld)
    except Exception:
        product_obj = None

    site_origin = meta.canonical_url.split('/part/')[0]
    breadcrumb_obj = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
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
                "name": "Каталог",
                "item": f"{site_origin}/catalog",
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": meta.h1,
                "item": meta.canonical_url,
            },
        ],
    }

    if product_obj:
        graph_obj = {"@context": "https://schema.org", "@graph": [product_obj, breadcrumb_obj]}
    else:
        graph_obj = breadcrumb_obj

    json_ld_graph = json.dumps(graph_obj, ensure_ascii=False)

    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <link rel="canonical" href="{canonical}" />
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
  <article>
    <h1>{h1}</h1>
    <p>{body_desc}</p>{product_desc_block}
  </article>
</body>
</html>
"""
