from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.services.product_alternate_offers_service import find_alternate_used_product_offers
from app.services.product_reference_fitment_service import (
    format_fitment_text,
    get_reference_fitment_vehicles,
    merge_fitment_vehicles,
)
from app.services.spa_page_check_service import PART_PATH_RE, _normalize_path
from app.services.yandex_feed_xml_service import _absolute_photo_url, _resolve_site_origin
from app.utils.page_keywords import build_page_keywords
from app.utils.product_display_name import extract_product_description, format_product_display_title
from app.utils.product_part_faq import build_product_faq_items, build_product_faq_json_ld
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
    part_type_name: str = ""
    seller_name: str = ""
    seller_url: str = ""
    fitment_text: str = ""
    internal_code: str = ""
    alternate_offers: tuple[tuple[str, str], ...] = ()


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


def _load_product(db: Session, product_id: int, *, require_stock: bool = True) -> ProductModel | None:
    query = (
        db.query(ProductModel)
        .options(
            selectinload(ProductModel.photos),
            selectinload(ProductModel.organization),
            selectinload(ProductModel.part_type),
            selectinload(ProductModel.compatible_vehicles),
        )
        .filter(ProductModel.id == product_id)
    )
    if require_stock:
        query = query.filter(ProductModel.quantity > 0)
    return query.first()


def build_product_seo_meta(
    product: ProductModel,
    *,
    site_origin: str | None = None,
    db: Session | None = None,
) -> ProductSeoMeta:
    origin = _resolve_site_origin(site_origin)
    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    name = format_product_display_title(brand, article, product.name)
    short_name = str(extract_product_description(product.name, brand, article) or "").strip()
    canonical_url = build_product_page_url(product, origin)

    organization = getattr(product, "organization", None)
    org_address = getattr(organization, "address", None) if organization else None
    org_name_raw = getattr(organization, "name", None) if organization else None
    org_name = org_name_raw.strip() if isinstance(org_name_raw, str) and org_name_raw.strip() else None
    org_phone_raw = getattr(organization, "phone", None) if organization else None
    org_phone = org_phone_raw.strip() if isinstance(org_phone_raw, str) and org_phone_raw.strip() else None
    city = resolve_product_city(organization_address=str(org_address) if org_address is not None else None)
    part_type = getattr(product, "part_type", None)
    part_type_name = (getattr(part_type, "name", None) or "").strip()

    title = build_product_search_title(
        brand=brand,
        article=article,
        product_name=product.name,
        part_type_name=part_type_name,
        short_name=short_name,
        city=city,
        is_new=bool(product.is_new),
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
        part_type_name=part_type_name,
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

    seller_vehicle_dicts = [
        {
            "brand": getattr(vehicle, "brand", None),
            "model": getattr(vehicle, "model", None),
            "generation": getattr(vehicle, "generation", None),
        }
        for vehicle in (product.compatible_vehicles or [])
    ]
    reference_vehicle_dicts: list[dict[str, str]] = []
    alternate_offers: tuple[tuple[str, str], ...] = ()
    fitment_text = ""
    if db is not None and brand and article:
        reference_vehicle_dicts = get_reference_fitment_vehicles(
            db,
            brand=brand,
            article=article,
            exclude_product_id=int(product.id),
        )
        merged_fitment = merge_fitment_vehicles(seller_vehicle_dicts, reference_vehicle_dicts)
        fitment_text = format_fitment_text(merged_fitment)
        offers = find_alternate_used_product_offers(
            db,
            brand=brand,
            article=article,
            exclude_product_id=int(product.id),
            limit=5,
            site_origin=origin,
        )
        alternate_offers = tuple((offer.label, offer.url) for offer in offers)

    if fitment_text:
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
            part_type_name=part_type_name,
            fitment_hint=fitment_text,
        )

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
        brand=brand,
        article=article,
        part_type_name=part_type_name,
        is_new=bool(product.is_new),
        city=city,
        fitment_text=fitment_text,
        in_stock=in_stock,
    )
    body_description = product_body_description(
        brand=brand,
        article=article,
        name=name,
        unique_description=unique_desc,
        short_name=short_name,
        part_type_name=part_type_name,
        city=city,
        fitment_text=fitment_text,
        seller_name=org_name,
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
    internal_code = str(getattr(product, "internal_code", "") or "").strip()
    seller_url = ""
    if organization and getattr(organization, "id", None):
        seller_url = f"{origin.rstrip('/')}/organizations/{organization.id}"

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
        part_type_name=part_type_name,
        seller_name=org_name or "",
        seller_url=seller_url,
        fitment_text=fitment_text,
        internal_code=internal_code,
        alternate_offers=alternate_offers,
    )


def build_product_json_ld_graph(
    *,
    json_ld: str,
    canonical_url: str,
    h1: str,
    title: str | None = None,
    description: str | None = None,
    brand: str | None = None,
    article: str | None = None,
    part_type_name: str | None = None,
    is_new: bool = False,
    city: str | None = None,
    fitment_text: str | None = None,
    in_stock: bool = True,
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
        graph.append(
            build_product_faq_json_ld(
                canonical_url=canonical_url,
                brand=brand,
                article=article,
                part_type_name=part_type_name,
                is_new=is_new,
                city=city,
                fitment_text=fitment_text,
                in_stock=in_stock,
            )
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
    product = _load_product(db, product_id, require_stock=False)
    if product is None:
        return None
    if (product.quantity or 0) <= 0:
        return None
    return build_product_seo_meta(product, db=db)


def resolve_out_of_stock_part_redirect(
    db: Session,
    raw_path: str,
    *,
    site_origin: str | None = None,
) -> str | None:
    """301 target for sold-out cards when alternate offers exist."""
    product_id = parse_part_path_product_id(raw_path)
    if product_id is None:
        return None
    product = _load_product(db, product_id, require_stock=False)
    if product is None or (product.quantity or 0) > 0:
        return None
    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    if not brand or not article:
        return None
    origin = _resolve_site_origin(site_origin)
    offers = find_alternate_used_product_offers(
        db,
        brand=brand,
        article=article,
        exclude_product_id=int(product.id),
        limit=1,
        site_origin=origin,
    )
    if not offers:
        return None
    catalog_url = build_product_used_catalog_url(product, origin)
    return catalog_url


def render_product_prerender_html(meta: ProductSeoMeta) -> str:
    title = html.escape(meta.title, quote=True)
    description = html.escape(meta.description, quote=True)
    canonical = html.escape(meta.canonical_url, quote=True)
    h1 = html.escape(meta.h1)
    about_text = html.escape(meta.body_description or meta.seo_summary or meta.description)
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
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=meta.condition_label == "Новая",
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
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

    stock_label = "В наличии" if meta.in_stock else "Нет в наличии"
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
    internal_code_row = (
        f"<dt>Код товара</dt><dd>{html.escape(meta.internal_code)}</dd>"
        if meta.internal_code
        else ""
    )
    price_row = (
        f"<dt>Цена</dt><dd>{html.escape(meta.price)} ₽</dd>"
        if meta.price
        else ""
    )
    stock_row = f"<dt>Наличие</dt><dd>{html.escape(stock_label)}</dd>"
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
    part_type_row = (
        f"<dt>Тип детали</dt><dd>{html.escape(meta.part_type_name)}</dd>"
        if meta.part_type_name
        else ""
    )
    seller_row = ""
    if meta.seller_name:
        if meta.seller_url:
            seller_row = (
                f'<dt>Продавец</dt><dd><a href="{html.escape(meta.seller_url, quote=True)}">'
                f"{html.escape(meta.seller_name)}</a></dd>"
            )
        else:
            seller_row = f"<dt>Продавец</dt><dd>{html.escape(meta.seller_name)}</dd>"
    details_html = (
        "    <dl>"
        f"{brand_row}{article_row}{internal_code_row}{price_row}{stock_row}"
        f"{city_row}{condition_row}{part_type_row}{seller_row}"
        "</dl>\n"
    )

    about_html = (
        f"    <h2>О запчасти</h2>\n"
        f"    <p>{about_text}</p>\n"
    )
    delivery_html = (
        "    <h2>Доставка и оплата</h2>\n"
        "    <p>Доставка по России и самовывоз у продавца. Способы оплаты и сроки "
        f"отправки согласуются при оформлении заказа. Подробнее — "
        f'<a href="{html.escape(site_origin, quote=True)}/delivery">страница «Доставка»</a>.</p>\n'
    )
    warranty_html = (
        "    <h2>Гарантия и осмотр</h2>\n"
        "    <p>Б/у запчасть рекомендуется осмотреть перед покупкой или запросить "
        "дополнительные фото и видео у продавца. Условия возврата и гарантии "
        "уточняйте у продавца до оплаты.</p>\n"
    )
    if meta.condition_label == "Новая":
        warranty_html = (
            "    <h2>Гарантия и комплектация</h2>\n"
            "    <p>Новая запчасть. Состояние упаковки, комплектацию и условия "
            "гарантии уточняйте у продавца до оплаты.</p>\n"
        )

    fitment_html = ""
    if meta.fitment_text:
        fitment_html = (
            f"    <h2>Подходит для автомобилей</h2>\n"
            f"    <p>{html.escape(meta.fitment_text)}</p>\n"
            "    <p><em>Справочная информация. Перед покупкой уточните совместимость у продавца.</em></p>\n"
        )
    alternate_offers_html = ""
    if meta.alternate_offers:
        items = "".join(
            f'<li><a href="{html.escape(url, quote=True)}">{html.escape(label)}</a></li>'
            for label, url in meta.alternate_offers
        )
        alternate_offers_html = (
            f"    <h2>Другие предложения {html.escape(meta.brand)} {html.escape(meta.article)}</h2>\n"
            f"    <ul>{items}</ul>\n"
        )

    faq_items = build_product_faq_items(
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=meta.condition_label == "Новая",
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
    )
    faq_html = ""
    if faq_items:
        faq_entries = "".join(
            f"      <details><summary>{html.escape(item['question'])}</summary>"
            f"<p>{html.escape(item['answer'])}</p></details>\n"
            for item in faq_items
        )
        faq_html = f"    <h2>Частые вопросы</h2>\n    <section>\n{faq_entries}    </section>\n"

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
{about_html}{details_html}{fitment_html}{delivery_html}{warranty_html}{alternate_offers_html}{faq_html}{used_catalog_link}  </article>
</body>
</html>
"""
