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
from app.utils.product_display_name import format_product_display_title
from app.utils.product_urls import build_product_page_url


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
        .options(selectinload(ProductModel.photos))
        .filter(ProductModel.id == product_id, ProductModel.quantity > 0)
        .first()
    )


def build_product_seo_meta(product: ProductModel, *, site_origin: str | None = None) -> ProductSeoMeta:
    origin = _resolve_site_origin(site_origin)
    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    name = format_product_display_title(brand, article, product.name)
    condition = "новая" if product.is_new else "б/у"
    canonical_url = build_product_page_url(product, origin)
    title = f"{name} | Свой Гараж".strip()

    unique_desc = _strip_html(product.description)
    if len(unique_desc) > 40:
        description = unique_desc[:160]
    else:
        description = f"{condition.capitalize()} автозапчасть с доставкой по России."

    image_url = None
    for photo in product.photos or []:
        image_url = _absolute_photo_url(getattr(photo, "photo_url", None), origin)
        if image_url:
            break

    price = None
    if product.price is not None:
        try:
            price = f"{float(product.price):.2f}"
        except (TypeError, ValueError):
            price = str(product.price)

    in_stock = (product.quantity or 0) > 0
    offer = None
    if price:
        offer = {
            "@type": "Offer",
            "url": canonical_url,
            "priceCurrency": "RUB",
            "price": price,
            "availability": "https://schema.org/InStock"
            if in_stock
            else "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition"
            if product.is_new
            else "https://schema.org/UsedCondition",
        }

    json_ld_obj = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "sku": article or None,
        "description": (unique_desc[:500] if unique_desc else description),
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
    image_tag = (
        f'<meta property="og:image" content="{html.escape(meta.image_url, quote=True)}" />'
        if meta.image_url
        else ""
    )
    price_line = ""
    if meta.price:
        price_line = f"<p>Цена: {html.escape(meta.price)} ₽</p>"

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
  <script type="application/ld+json">{meta.json_ld}</script>
</head>
<body>
  <article>
    <h1>{h1}</h1>
    <p>{body_desc}</p>
    {price_line}
    <p><a href="{canonical}">Открыть карточку на Свой Гараж</a></p>
  </article>
</body>
</html>
"""
