from __future__ import annotations

import html
import json
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import quote, unquote

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.new_parts_seo_card import NewPartsSeoCard
from app.models.seo_landing_page import SeoLandingPage
from app.utils.slug_utils import slugify_brand
from app.services.yandex_feed_xml_service import _absolute_photo_url, _resolve_site_origin
from app.utils.product_json_ld import (
    build_json_ld_script_tags,
    build_new_part_card_json_ld,
    build_product_article_microdata_prefix,
    build_product_og_meta_tags,
    dumps_json_ld,
    product_body_description,
    split_graph_json_ld_for_yandex,
)
from app.utils.product_search_seo import (
    build_new_part_h1,
    build_new_part_search_description,
    build_new_part_search_title,
    product_schema_name_from_title,
)
from app.utils.product_part_faq import build_product_faq_items, build_product_faq_json_ld
from app.utils.new_part_price_utils import min_stock_base_price, min_stock_price_with_markup
from app.utils.org_markup import global_markup_percent
from app.utils.seo_constants import HTML_OG_PRODUCT_PREFIX, SITE_OWNERSHIP_META_HTML, resolve_product_placeholder_image_url
from app.utils.page_keywords import build_page_keywords
from app.utils.site_settings_db import get_or_create_site_settings

ROSSKO_NEW_PART_SOURCE = "rossko"


@dataclass(frozen=True)
class NewPartSeoMeta:
    title: str
    description: str
    canonical_url: str
    h1: str
    image_url: str | None
    price: str | None
    in_stock: bool
    json_ld: str
    json_ld_graph: str = ""
    schema_name: str = ""
    keywords: str = ""
    product_description: str | None = None
    seo_summary: str = ""
    brand: str = ""
    article: str = ""
    city: str = ""
    fitment_text: str = ""
    stock_summary: str = ""
    part_type_name: str = ""
    used_catalog_url: str = ""
    robots: str = "index, follow"
    warehouse_count: int = 0
    quantity: int = 0
    listing_id: int = 0


def build_new_part_stock_summary(card: NewPartsSeoCard) -> tuple[str, int, int]:
    """Returns (summary text, warehouse_count, total_available)."""
    stocks = _stocks_from_card(card)
    available = [row for row in stocks if int(row.get("available_count") or 0) > 0]
    total_qty = sum(int(row.get("available_count") or 0) for row in available)
    warehouse_count = len(available)
    if not available:
        qty = max(0, int(card.stock_count or 0))
        if qty > 0:
            return (f"В наличии у поставщика ({qty} шт.)", 1, qty)
        return ("", 0, 0)

    parts: list[str] = []
    if warehouse_count == 1:
        parts.append(f"В наличии на 1 складе ({total_qty} шт.)")
    else:
        parts.append(f"В наличии на {warehouse_count} складах ({total_qty} шт.)")

    earliest = None
    latest = None
    for row in available:
        start = _parse_iso_datetime(row.get("delivery_start"))
        end = _parse_iso_datetime(row.get("delivery_end"))
        if start and (earliest is None or start < earliest):
            earliest = start
        if end and (latest is None or end > latest):
            latest = end
    if earliest and latest:
        parts.append(
            f"отгрузка ориентировочно с {earliest.strftime('%d.%m.%Y')} "
            f"по {latest.strftime('%d.%m.%Y')}"
        )
    elif earliest:
        parts.append(f"отгрузка ориентировочно с {earliest.strftime('%d.%m.%Y')}")

    return (". ".join(parts), warehouse_count, total_qty)


def _safe_text(value: object, *, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip() or default
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, dict):
        msg = value.get("msg") if isinstance(value.get("msg"), str) else None
        return (msg or default).strip() if msg else default
    return default


def _truncate(value: str, max_len: int) -> str:
    text = " ".join(str(value or "").split()).strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1].rstrip()}…"


def _parse_iso_datetime(value: object) -> datetime | None:
    text = _safe_text(value)
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except Exception:
        return None


def _stable_key(source: str, brand: str, article: str) -> str:
    return f"{source}|{brand.casefold()}|{article.casefold()}"


def build_new_part_card_path(card_id: int, brand: str, article: str) -> str:
    brand_text = _safe_text(brand)
    article_text = _safe_text(article)
    if brand_text and article_text:
        return (
            f"/autoparts/new/part/{card_id}"
            f"-{quote(brand_text, safe='')}-{quote(article_text, safe='')}"
        )
    return f"/autoparts/new/part/{card_id}"


def _normalize_stock_entry(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None
    stock_id = _safe_text(raw.get("stock_id"))
    if not stock_id:
        return None
    price_raw = raw.get("price")
    price_value = None
    if price_raw is not None and str(price_raw).strip() != "":
        try:
            price_value = round(float(price_raw), 2)
        except Exception:
            price_value = None
    try:
        available_count = max(0, int(raw.get("available_count") or 0))
    except Exception:
        available_count = 0
    return {
        "stock_id": stock_id,
        "price": price_value,
        "available_count": available_count,
        "delivery_start": _safe_text(raw.get("delivery_start")) or None,
        "delivery_end": _safe_text(raw.get("delivery_end")) or None,
    }


def _merge_stocks(existing: list[dict], incoming: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for item in [*existing, *incoming]:
        normalized = _normalize_stock_entry(item)
        if not normalized:
            continue
        key = normalized["stock_id"]
        prev = merged.get(key)
        if prev is None or normalized["available_count"] > prev["available_count"]:
            merged[key] = normalized
    return list(merged.values())


def _payload_from_raw(card: NewPartsSeoCard) -> dict:
    if not card.raw_payload:
        return {}
    try:
        data = json.loads(card.raw_payload)
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _stocks_from_card(card: NewPartsSeoCard) -> list[dict]:
    payload = _payload_from_raw(card)
    stocks = payload.get("stocks")
    normalized: list[dict] = []
    if isinstance(stocks, list):
        for item in stocks:
            row = _normalize_stock_entry(item)
            if row:
                normalized.append(row)
    if normalized:
        return normalized
    supplier_stock_id = _safe_text(payload.get("supplier_stock_id"))
    if supplier_stock_id:
        return [
            {
                "stock_id": supplier_stock_id,
                "price": float(card.price) if card.price is not None else None,
                "available_count": int(card.stock_count or 0),
                "delivery_start": card.delivery_start.isoformat() if card.delivery_start else None,
                "delivery_end": card.delivery_end.isoformat() if card.delivery_end else None,
            }
        ]
    return []


def _merge_payload(existing_payload: dict, incoming: dict) -> dict:
    merged = dict(existing_payload or {})
    for key in ("name", "description", "image_url", "guid", "supplier_stock_id"):
        if not _safe_text(merged.get(key)) and _safe_text(incoming.get(key)):
            merged[key] = incoming.get(key)
    merged["stocks"] = _merge_stocks(
        merged.get("stocks") if isinstance(merged.get("stocks"), list) else [],
        incoming.get("stocks") if isinstance(incoming.get("stocks"), list) else [],
    )
    if not merged["stocks"] and _safe_text(incoming.get("supplier_stock_id")):
        single = _normalize_stock_entry(
            {
                "stock_id": incoming.get("supplier_stock_id"),
                "price": incoming.get("price"),
                "available_count": incoming.get("stock_count"),
                "delivery_start": incoming.get("delivery_start"),
                "delivery_end": incoming.get("delivery_end"),
            }
        )
        if single:
            merged["stocks"] = [single]
    return merged


def is_rossko_new_part_sitemap_eligible(card: NewPartsSeoCard) -> bool:
    """
    Карточка раздела /autoparts/new, созданная из ответа Rossko API
    (не каталог б/у и не другие источники). В sitemap — только при реальном наличии.
    """
    if not card.is_active:
        return False
    if _safe_text(card.source).casefold() != ROSSKO_NEW_PART_SOURCE:
        return False
    if not _safe_text(card.brand) or not _safe_text(card.article):
        return False
    stocks = _stocks_from_card(card)
    if any(int(row.get("available_count") or 0) > 0 for row in stocks):
        return True
    return max(0, int(card.stock_count or 0)) > 0


def has_new_part_real_stock(card: NewPartsSeoCard) -> bool:
    stocks = _stocks_from_card(card)
    if any(int(row.get("available_count") or 0) > 0 for row in stocks):
        return True
    return max(0, int(card.stock_count or 0)) > 0


def iter_rossko_new_part_cards_for_sitemap(db: Session):
    rows = (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
        )
        .order_by(NewPartsSeoCard.updated_at.desc().nullslast(), NewPartsSeoCard.id.desc())
        .all()
    )
    for card in rows:
        if is_rossko_new_part_sitemap_eligible(card):
            yield card


def count_rossko_new_part_cards_for_sitemap(db: Session) -> int:
    return sum(1 for _ in iter_rossko_new_part_cards_for_sitemap(db))


def create_or_get_new_part_card(db: Session, payload: dict) -> NewPartsSeoCard:
    source = _safe_text(payload.get("source"), default=ROSSKO_NEW_PART_SOURCE) or ROSSKO_NEW_PART_SOURCE
    brand = _safe_text(payload.get("brand"), default="Неизвестный бренд")
    article = _safe_text(payload.get("article"), default="Без артикула")
    stable_key = _stable_key(source, brand, article)
    incoming_stocks = payload.get("stocks") if isinstance(payload.get("stocks"), list) else []
    if incoming_stocks:
        payload = {**payload, "stocks": _merge_stocks([], incoming_stocks)}
    elif _safe_text(payload.get("supplier_stock_id")):
        single = _normalize_stock_entry(
            {
                "stock_id": payload.get("supplier_stock_id"),
                "price": payload.get("price"),
                "available_count": payload.get("stock_count"),
                "delivery_start": payload.get("delivery_start"),
                "delivery_end": payload.get("delivery_end"),
            }
        )
        if single:
            payload = {**payload, "stocks": [single]}

    existing = db.query(NewPartsSeoCard).filter(NewPartsSeoCard.stable_key == stable_key).first()
    if existing is None:
        existing = (
            db.query(NewPartsSeoCard)
            .filter(
                NewPartsSeoCard.source == source,
                NewPartsSeoCard.brand == brand,
                NewPartsSeoCard.article == article,
                NewPartsSeoCard.is_active.is_(True),
            )
            .order_by(NewPartsSeoCard.id.desc())
            .first()
        )
    if existing:
        merged_payload = _merge_payload(_payload_from_raw(existing), payload)
        existing.raw_payload = json.dumps(merged_payload, ensure_ascii=False)
        existing.stable_key = stable_key
        stocks = merged_payload.get("stocks") if isinstance(merged_payload.get("stocks"), list) else []
        primary = stocks[0] if stocks else None
        if primary:
            if primary.get("price") is not None:
                existing.price = primary.get("price")
            existing.stock_count = int(primary.get("available_count") or 0)
            existing.delivery_start = _parse_iso_datetime(primary.get("delivery_start"))
            existing.delivery_end = _parse_iso_datetime(primary.get("delivery_end"))
        if _safe_text(payload.get("name")):
            existing.name = _safe_text(payload.get("name"))
        if _safe_text(payload.get("description")):
            existing.description = _safe_text(payload.get("description"))
        if _safe_text(payload.get("image_url")):
            existing.image_url = _safe_text(payload.get("image_url"))
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    name = _safe_text(payload.get("name"))
    description = _safe_text(payload.get("description"))
    image_url = _safe_text(payload.get("image_url"))
    price_raw = payload.get("price")
    price_value = None
    if price_raw is not None and str(price_raw).strip() != "":
        try:
            price_value = round(float(price_raw), 2)
        except Exception:
            price_value = None

    row = NewPartsSeoCard(
        source=source,
        stable_key=stable_key,
        brand=brand,
        article=article,
        name=name or None,
        description=description or None,
        price=price_value,
        currency=_safe_text(payload.get("currency"), default="RUB") or "RUB",
        stock_count=int(payload.get("stock_count") or 0) if str(payload.get("stock_count") or "").strip() else 0,
        delivery_start=_parse_iso_datetime(payload.get("delivery_start")),
        delivery_end=_parse_iso_datetime(payload.get("delivery_end")),
        image_url=image_url or None,
        raw_payload=json.dumps(payload, ensure_ascii=False),
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_new_part_card(db: Session, card_id: int) -> NewPartsSeoCard | None:
    return (
        db.query(NewPartsSeoCard)
        .filter(NewPartsSeoCard.id == card_id, NewPartsSeoCard.is_active.is_(True))
        .first()
    )


def find_active_new_part_card_by_brand_article(
    db: Session,
    brand: str | None,
    article: str | None,
) -> NewPartsSeoCard | None:
    """Активная SEO-карточка по бренду и артикулу (для ссылок из заказов)."""
    brand_text = _safe_text(brand)
    article_text = _safe_text(article)
    if not brand_text or not article_text:
        return None

    return (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.brand) == brand_text.lower(),
            func.lower(NewPartsSeoCard.article) == article_text.lower(),
        )
        .order_by(NewPartsSeoCard.id.desc())
        .first()
    )


def batch_lookup_active_new_part_card_ids(
    db: Session,
    pairs: list[tuple[str | None, str | None]],
) -> dict[tuple[str, str], int]:
    """Batch lookup active SEO card ids by (brand, article) pairs."""
    keys: set[tuple[str, str]] = set()
    for brand, article in pairs:
        brand_text = _safe_text(brand).lower()
        article_text = _safe_text(article).lower()
        if brand_text and article_text:
            keys.add((brand_text, article_text))
    if not keys:
        return {}

    brands = {brand for brand, _ in keys}
    articles = {article for _, article in keys}
    rows = (
        db.query(NewPartsSeoCard.id, NewPartsSeoCard.brand, NewPartsSeoCard.article)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.brand).in_(brands),
            func.lower(NewPartsSeoCard.article).in_(articles),
        )
        .order_by(NewPartsSeoCard.id.desc())
        .all()
    )
    out: dict[tuple[str, str], int] = {}
    for card_id, brand, article in rows:
        key = (_safe_text(brand).lower(), _safe_text(article).lower())
        if key in keys and key not in out:
            out[key] = int(card_id)
    return out


def seo_card_ids_for_order_items(
    db: Session,
    items: list,
) -> dict[int, int | None]:
    """Map garage new order item id -> seo_card_id without per-item queries."""
    if not items:
        return {}

    missing_pairs: list[tuple[str | None, str | None]] = []
    for item in items:
        stored = getattr(item, "seo_card_id", None)
        if stored:
            continue
        missing_pairs.append((getattr(item, "brand", None), getattr(item, "partnumber", None)))

    card_by_pair = batch_lookup_active_new_part_card_ids(db, missing_pairs)
    out: dict[int, int | None] = {}
    for item in items:
        stored = getattr(item, "seo_card_id", None)
        if stored:
            out[int(item.id)] = int(stored)
            continue
        brand_text = _safe_text(getattr(item, "brand", None)).lower()
        article_text = _safe_text(getattr(item, "partnumber", None)).lower()
        if brand_text and article_text:
            out[int(item.id)] = card_by_pair.get((brand_text, article_text))
        else:
            out[int(item.id)] = None
    return out


def _brand_cards_base_query(db: Session, brand: str):
    brand_text = _safe_text(brand)
    return (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
            func.lower(NewPartsSeoCard.brand) == brand_text.lower(),
        )
        .order_by(
            NewPartsSeoCard.stock_count.desc().nullslast(),
            NewPartsSeoCard.updated_at.desc().nullslast(),
            NewPartsSeoCard.id.desc(),
        )
    )


def count_new_part_cards_by_brand(db: Session, brand: str) -> int:
    return _brand_cards_base_query(db, brand).count()


def list_new_part_cards_by_brand(
    db: Session,
    brand: str,
    *,
    page: int = 1,
    page_size: int = 48,
) -> tuple[list[NewPartsSeoCard], int]:
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 48), 100))
    query = _brand_cards_base_query(db, brand)
    total = query.count()
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()
    return rows, total


def iter_new_part_cards_by_brand_for_prerender(
    db: Session,
    brand: str,
    *,
    limit: int = 48,
) -> list[NewPartsSeoCard]:
    return _brand_cards_base_query(db, brand).limit(max(1, min(limit, 100))).all()


def resolve_category_search_query(db: Session, category_slug: str) -> str | None:
    slug_text = (category_slug or "").strip()
    if not slug_text:
        return None
    row = (
        db.query(SeoLandingPage)
        .filter(
            SeoLandingPage.kind == "category_new",
            SeoLandingPage.slug == slug_text,
            SeoLandingPage.is_active.is_(True),
        )
        .first()
    )
    if not row:
        return None
    search_query = _safe_text(row.search_query)
    return search_query or None


def _category_cards_base_query(db: Session, search_query: str):
    query_text = _safe_text(search_query).lower()
    return (
        db.query(NewPartsSeoCard)
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
            func.lower(NewPartsSeoCard.name).like(f"%{query_text}%"),
        )
        .order_by(
            NewPartsSeoCard.stock_count.desc().nullslast(),
            NewPartsSeoCard.updated_at.desc().nullslast(),
            NewPartsSeoCard.id.desc(),
        )
    )


def count_new_part_cards_by_category_slug(db: Session, category_slug: str) -> int:
    search_query = resolve_category_search_query(db, category_slug)
    if not search_query:
        return 0
    return _category_cards_base_query(db, search_query).count()


def list_new_part_cards_by_category_slug(
    db: Session,
    category_slug: str,
    *,
    page: int = 1,
    page_size: int = 48,
) -> tuple[list[NewPartsSeoCard], int]:
    search_query = resolve_category_search_query(db, category_slug)
    if not search_query:
        return [], 0
    page = max(1, int(page or 1))
    page_size = max(1, min(int(page_size or 48), 100))
    query = _category_cards_base_query(db, search_query)
    total = query.count()
    offset = (page - 1) * page_size
    rows = query.offset(offset).limit(page_size).all()
    return rows, total


def iter_new_part_cards_by_category_for_prerender(
    db: Session,
    category_slug: str,
    *,
    limit: int = 48,
) -> list[NewPartsSeoCard]:
    search_query = resolve_category_search_query(db, category_slug)
    if not search_query:
        return []
    return _category_cards_base_query(db, search_query).limit(max(1, min(limit, 100))).all()


def aggregate_top_brands_in_category(
    db: Session,
    category_slug: str,
    *,
    limit: int = 12,
) -> list[dict[str, object]]:
    search_query = resolve_category_search_query(db, category_slug)
    if not search_query:
        return []
    rows = (
        db.query(
            func.max(NewPartsSeoCard.brand).label("brand"),
            func.count(NewPartsSeoCard.id).label("count"),
        )
        .filter(
            NewPartsSeoCard.is_active.is_(True),
            func.lower(NewPartsSeoCard.source) == ROSSKO_NEW_PART_SOURCE,
            func.lower(NewPartsSeoCard.name).like(f"%{search_query.lower()}%"),
        )
        .group_by(func.lower(NewPartsSeoCard.brand))
        .order_by(func.count(NewPartsSeoCard.id).desc())
        .limit(max(1, min(int(limit or 12), 24)))
        .all()
    )
    result: list[dict[str, object]] = []
    for row in rows:
        brand = _safe_text(row.brand)
        if not brand:
            continue
        slug = slugify_brand(brand)
        if not slug:
            continue
        result.append({"brand": brand, "slug": slug, "count": int(row.count or 0)})
    return result


def build_new_part_json_ld_graph(
    *,
    json_ld: str,
    canonical_url: str,
    h1: str,
    title: str | None = None,
    description: str | None = None,
    brand: str | None = None,
    article: str | None = None,
    in_stock: bool = True,
    city: str | None = None,
    fitment_text: str | None = None,
    part_type_name: str | None = None,
    quantity: int | None = None,
    price: float | int | str | None = None,
    stock_summary: str | None = None,
) -> str:
    """Product + BreadcrumbList + WebPage для JSON-LD Rossko-карточек."""
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

    site_origin = canonical_url.split("/autoparts/new/part/")[0]
    breadcrumb_obj = {
        "@type": "BreadcrumbList",
        "@id": f"{canonical_url}#breadcrumb",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Главная",
                "item": site_origin,
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": "Новые запчасти",
                "item": f"{site_origin}/autoparts/new",
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
                is_new=True,
                city=city,
                fitment_text=fitment_text,
                in_stock=in_stock,
                quantity=quantity,
                price=price,
                stock_summary=stock_summary,
            )
        )

    if len(graph) == 1:
        graph_obj = {"@context": "https://schema.org", **graph[0]}
    else:
        graph_obj = {"@context": "https://schema.org", "@graph": graph}

    return json.dumps(graph_obj, ensure_ascii=False)


def build_new_part_seo_meta(
    card: NewPartsSeoCard,
    *,
    site_origin: str | None = None,
    markup_percent: float | None = None,
    db: Session | None = None,
) -> NewPartSeoMeta:
    from app.services.product_reference_fitment_service import (
        format_fitment_text,
        get_reference_fitment_vehicles,
    )
    from app.utils.organization_city import DEFAULT_CITY
    from app.utils.product_display_name import extract_product_description
    from app.utils.product_search_seo import build_product_seo_summary

    origin = _resolve_site_origin(site_origin)
    brand = str(card.brand or "").strip()
    article = str(card.article or "").strip()
    display_name = _safe_text(card.name) or f"{brand} {article}".strip()
    short_name = str(extract_product_description(card.name, brand, article) or "").strip()
    part_type_name = short_name
    markup = float(markup_percent) if markup_percent is not None else 15.0
    display_price = min_stock_price_with_markup(card, markup)
    seo_price = min_stock_base_price(card)
    stock_summary, warehouse_count, quantity = build_new_part_stock_summary(card)
    in_stock = has_new_part_real_stock(card)
    city = DEFAULT_CITY
    fitment_text = ""
    if db is not None and brand and article:
        try:
            vehicles = get_reference_fitment_vehicles(db, brand=brand, article=article)
            fitment_text = format_fitment_text(vehicles)
        except Exception:
            fitment_text = ""

    title = build_new_part_search_title(
        brand=card.brand,
        article=card.article,
        raw_name=_safe_text(card.name),
        card_id=int(card.id),
        price=seo_price,
    )
    h1 = build_new_part_h1(
        brand=card.brand,
        article=card.article,
        raw_name=_safe_text(card.name),
    )
    schema_name = product_schema_name_from_title(title)
    description = build_new_part_search_description(
        brand=card.brand,
        article=card.article,
        raw_name=_safe_text(card.name),
        card_id=int(card.id),
        price=seo_price,
        in_stock=in_stock,
        unique_description=_safe_text(card.description),
    )
    price_text = f"{display_price:.2f}" if display_price is not None else None
    canonical = f"{origin}{build_new_part_card_path(card.id, card.brand, card.article)}"
    image_url = _absolute_photo_url(_safe_text(card.image_url), origin) or resolve_product_placeholder_image_url(origin)
    used_catalog_url = ""
    if brand and article:
        from urllib.parse import quote as url_quote

        used_catalog_url = f"{origin}/autoparts/used?q={url_quote(f'{brand} {article}')}"

    product_json_ld = build_new_part_card_json_ld(
        card,
        site_origin=origin,
        canonical_url=canonical,
        display_price=display_price,
        schema_name=schema_name,
    )
    json_ld = dumps_json_ld(product_json_ld)
    body_description = product_body_description(
        brand=brand,
        article=article,
        name=display_name,
        unique_description=_safe_text(card.description),
        short_name=short_name,
        part_type_name=part_type_name,
        city=city,
        fitment_text=fitment_text,
        is_new=True,
        price=seo_price if seo_price is not None else display_price,
        quantity=quantity,
        in_stock=in_stock,
        stock_summary=stock_summary,
        listing_id=int(card.id),
    )
    seo_summary = build_product_seo_summary(
        brand=brand,
        article=article,
        name=display_name,
        is_new=True,
        city=city,
        price=seo_price if seo_price is not None else display_price,
        in_stock=in_stock,
        short_name=short_name,
        unique_description=_safe_text(card.description),
        fitment_text=fitment_text,
        quantity=quantity,
        stock_summary=stock_summary,
    )
    json_ld_graph = build_new_part_json_ld_graph(
        json_ld=json_ld,
        canonical_url=canonical,
        h1=h1,
        title=title,
        description=description,
        brand=brand,
        article=article,
        in_stock=in_stock,
        city=city,
        fitment_text=fitment_text,
        part_type_name=part_type_name,
        quantity=quantity,
        price=seo_price if seo_price is not None else display_price,
        stock_summary=stock_summary,
    )
    robots = "index, follow" if in_stock else "noindex, follow"

    return NewPartSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical,
        h1=h1,
        schema_name=schema_name,
        image_url=image_url,
        price=price_text,
        in_stock=in_stock,
        json_ld=json_ld,
        json_ld_graph=json_ld_graph,
        keywords=build_page_keywords(
            "new_part_card",
            brand=card.brand,
            article=card.article,
        ),
        product_description=body_description,
        seo_summary=seo_summary,
        brand=brand,
        article=article,
        city=city,
        fitment_text=fitment_text,
        stock_summary=stock_summary,
        part_type_name=part_type_name,
        used_catalog_url=used_catalog_url,
        robots=robots,
        warehouse_count=warehouse_count,
        quantity=quantity,
        listing_id=int(card.id),
    )


def parse_new_part_path_card_id(path: str) -> int | None:
    normalized = unquote((path or "").split("?", 1)[0].strip())
    parts = [p for p in normalized.split("/") if p]
    if len(parts) < 4:
        return None
    if parts[0] != "autoparts" or parts[1] != "new" or parts[2] != "part":
        return None
    segment = parts[3]
    segment_parts = segment.split("-")
    if not segment_parts:
        return None
    try:
        return int(segment_parts[0])
    except Exception:
        return None


def get_new_part_seo_for_path(db: Session, raw_path: str) -> NewPartSeoMeta | None:
    card_id = parse_new_part_path_card_id(raw_path)
    if card_id is None:
        return None
    card = get_new_part_card(db, card_id)
    if card is None:
        return None
    settings_row = get_or_create_site_settings(db)
    markup_percent = global_markup_percent(settings_row)
    return build_new_part_seo_meta(card, markup_percent=markup_percent, db=db)


def render_new_part_prerender_html(meta: NewPartSeoMeta) -> str:
    title = html.escape(meta.title, quote=True)
    description = html.escape(meta.description, quote=True)
    canonical = html.escape(meta.canonical_url, quote=True)
    h1 = html.escape(meta.h1)
    about_text = html.escape(meta.product_description or meta.seo_summary or meta.description)
    image_tag = f'<meta property="og:image" content="{html.escape(meta.image_url or resolve_product_placeholder_image_url(""), quote=True)}" />'
    image_block = ""
    if meta.image_url:
        image_block = f'\n    <img src="{html.escape(meta.image_url, quote=True)}" alt="{h1}" />'
    json_ld_graph = meta.json_ld_graph or build_new_part_json_ld_graph(
        json_ld=meta.json_ld,
        canonical_url=meta.canonical_url,
        h1=meta.h1,
        title=meta.title,
        description=meta.description,
        brand=meta.brand,
        article=meta.article,
        in_stock=meta.in_stock,
        city=meta.city,
        fitment_text=meta.fitment_text,
        part_type_name=meta.part_type_name,
        quantity=meta.quantity,
        price=meta.price,
        stock_summary=meta.stock_summary,
    )
    json_ld_scripts = build_json_ld_script_tags(
        *split_graph_json_ld_for_yandex(
            product_json_ld=meta.json_ld,
            json_ld_graph=json_ld_graph,
        )
    )
    product_og_meta = build_product_og_meta_tags(price=meta.price, in_stock=meta.in_stock)
    schema_product_name = meta.schema_name or meta.title
    if meta.json_ld:
        try:
            parsed_product = json.loads(meta.json_ld)
            if isinstance(parsed_product, dict) and parsed_product.get("name"):
                schema_product_name = str(parsed_product["name"])
        except Exception:
            pass
    article_microdata = build_product_article_microdata_prefix(
        name=schema_product_name,
        description=meta.product_description or meta.description,
        brand=meta.brand,
        article=meta.article,
        image_url=meta.image_url,
        price=meta.price,
        in_stock=meta.in_stock,
        canonical_url=meta.canonical_url,
    )
    keywords_tag = ""
    if meta.keywords:
        keywords_tag = (
            f'  <meta name="keywords" content="{html.escape(meta.keywords, quote=True)}" />\n'
        )
    robots = html.escape(meta.robots or ("index, follow" if meta.in_stock else "noindex, follow"), quote=True)
    site_origin = meta.canonical_url.split("/autoparts/new/part/")[0]

    stock_label = "В наличии" if meta.in_stock else "Нет в наличии"
    if meta.in_stock and meta.quantity > 1:
        stock_label = f"В наличии ({meta.quantity} шт.)"
    brand_row = f"<dt>Бренд</dt><dd>{html.escape(meta.brand)}</dd>" if meta.brand else ""
    article_row = f"<dt>Артикул</dt><dd>{html.escape(meta.article)}</dd>" if meta.article else ""
    price_row = f"<dt>Цена</dt><dd>{html.escape(meta.price)} ₽</dd>" if meta.price else ""
    stock_row = f"<dt>Наличие</dt><dd>{html.escape(stock_label)}</dd>"
    warehouse_row = (
        f"<dt>Склады</dt><dd>{meta.warehouse_count}</dd>"
        if meta.warehouse_count > 0
        else ""
    )
    city_row = f"<dt>Город</dt><dd>{html.escape(meta.city)}</dd>" if meta.city else ""
    condition_row = "<dt>Состояние</dt><dd>Новая</dd>"
    part_type_row = (
        f"<dt>Тип детали</dt><dd>{html.escape(meta.part_type_name)}</dd>"
        if meta.part_type_name
        else ""
    )
    stock_summary_row = (
        f"<dt>Поставка</dt><dd>{html.escape(meta.stock_summary)}</dd>"
        if meta.stock_summary
        else ""
    )
    details_html = (
        "    <dl>"
        f"{brand_row}{article_row}{price_row}{stock_row}{warehouse_row}"
        f"{city_row}{condition_row}{part_type_row}{stock_summary_row}"
        "</dl>\n"
    )

    about_html = (
        f"    <h2>О запчасти</h2>\n"
        f"    <p>{about_text}</p>\n"
    )
    delivery_html = (
        "    <h2>Доставка и оплата</h2>\n"
        "    <p>Новая запчасть со склада поставщика. Доставка по России, "
        "сроки зависят от склада. Подробнее — "
        f'<a href="{html.escape(site_origin, quote=True)}/delivery">страница «Доставка»</a>.</p>\n'
    )
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
            "    <p><em>Справочная информация. Перед покупкой сверьте артикул и совместимость.</em></p>\n"
        )
    used_catalog_link = ""
    if meta.used_catalog_url:
        used_catalog_link = (
            f'    <p><a href="{html.escape(meta.used_catalog_url, quote=True)}">'
            f"Б/у варианты {html.escape(meta.brand)} {html.escape(meta.article)}</a></p>\n"
        )
    brand_slug = slugify_brand(meta.brand) if meta.brand else ""
    brand_link = ""
    if brand_slug:
        brand_link = (
            f'    <p><a href="{html.escape(site_origin, quote=True)}/autoparts/new/brand/'
            f'{html.escape(brand_slug, quote=True)}">Все новые {html.escape(meta.brand)}</a></p>\n'
        )

    faq_items = build_product_faq_items(
        brand=meta.brand,
        article=meta.article,
        part_type_name=meta.part_type_name,
        is_new=True,
        city=meta.city,
        fitment_text=meta.fitment_text,
        in_stock=meta.in_stock,
        quantity=meta.quantity,
        price=meta.price,
        stock_summary=meta.stock_summary,
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
        f'    <a href="{html.escape(site_origin, quote=True)}/autoparts/new">Новые запчасти</a> ›\n'
        f"    <span>{h1}</span>\n"
        "  </nav>\n"
    )

    return f"""<!DOCTYPE html>
<html lang="ru" prefix="{html.escape(HTML_OG_PRODUCT_PREFIX, quote=True)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
{SITE_OWNERSHIP_META_HTML}  <meta name="robots" content="{robots}" />
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
  {product_og_meta}
  {json_ld_scripts}
</head>
<body>
{breadcrumb_html}{article_microdata}    <h1>{h1}</h1>{image_block}
{about_html}{details_html}{fitment_html}{delivery_html}{warranty_html}{faq_html}{used_catalog_link}{brand_link}  </article>
</body>
</html>
"""
