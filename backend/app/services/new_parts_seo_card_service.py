from __future__ import annotations

import html
import json
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import quote, unquote

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.yandex_feed_xml_service import _absolute_photo_url, _resolve_site_origin
from app.utils.seo_constants import resolve_default_og_image_url

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
    (не каталог б/у и не другие источники).
    """
    if not card.is_active:
        return False
    if _safe_text(card.source).casefold() != ROSSKO_NEW_PART_SOURCE:
        return False
    if not _safe_text(card.brand) or not _safe_text(card.article):
        return False
    payload = _payload_from_raw(card)
    stocks = _stocks_from_card(card)
    if stocks:
        return True
    return bool(
        _safe_text(payload.get("supplier_stock_id"))
        or _safe_text(payload.get("guid"))
    )


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
    from sqlalchemy import func

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


def build_new_part_seo_meta(card: NewPartsSeoCard, *, site_origin: str | None = None) -> NewPartSeoMeta:
    origin = _resolve_site_origin(site_origin)
    display_name = _safe_text(card.name) or f"{card.brand} {card.article}"
    title = _truncate(f"{card.brand} {card.article} {display_name} — новая запчасть | Свой Гараж", 70)
    city = "Екатеринбурге"
    price_text = f"{float(card.price):.2f}" if card.price is not None else None
    in_stock = (card.stock_count or 0) > 0
    desc_core = _safe_text(card.description) or display_name
    description = _truncate(
        f"Купить {card.brand} {card.article}. Новая запчасть {'в наличии' if in_stock else 'под заказ'} в {city}. "
        f"{(price_text + ' ₽. ') if price_text else ''}Доставка по России. {desc_core}",
        160,
    )
    canonical = f"{origin}{build_new_part_card_path(card.id, card.brand, card.article)}"
    image_url = _absolute_photo_url(_safe_text(card.image_url), origin) or resolve_default_og_image_url(origin)

    product_json = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": display_name,
        "sku": card.article,
        "mpn": card.article,
        "description": description,
        "brand": {"@type": "Brand", "name": card.brand},
        "image": [image_url],
        "offers": {
            "@type": "Offer",
            "url": canonical,
            "priceCurrency": card.currency or "RUB",
            "price": price_text,
            "availability": "https://schema.org/InStock" if in_stock else "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition",
        },
    }
    product_json = {k: v for k, v in product_json.items() if v is not None}
    offers = product_json.get("offers")
    if isinstance(offers, dict):
        product_json["offers"] = {k: v for k, v in offers.items() if v is not None}

    return NewPartSeoMeta(
        title=title,
        description=description,
        canonical_url=canonical,
        h1=display_name,
        image_url=image_url,
        price=price_text,
        in_stock=in_stock,
        json_ld=json.dumps(product_json, ensure_ascii=False),
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
    return build_new_part_seo_meta(card)


def render_new_part_prerender_html(meta: NewPartSeoMeta) -> str:
    title = html.escape(meta.title, quote=True)
    description = html.escape(meta.description, quote=True)
    canonical = html.escape(meta.canonical_url, quote=True)
    h1 = html.escape(meta.h1)
    image_tag = f'<meta property="og:image" content="{html.escape(meta.image_url or resolve_default_og_image_url(), quote=True)}" />'

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
    <p>{html.escape(meta.description)}</p>
  </article>
</body>
</html>
"""
