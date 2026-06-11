from __future__ import annotations

import json
import re
from typing import Any

from app.utils.organization_city import DEFAULT_CITY
from app.utils.product_display_name import extract_product_description, format_product_display_title
from app.utils.product_search_seo import (
    build_product_alternate_names,
    build_product_offer_json_ld,
)
from app.utils.seo_constants import resolve_default_og_image_url

SCHEMA_ORG = "https://schema.org"
IN_STOCK = f"{SCHEMA_ORG}/InStock"
OUT_OF_STOCK = f"{SCHEMA_ORG}/OutOfStock"
NEW_CONDITION = f"{SCHEMA_ORG}/NewCondition"
USED_CONDITION = f"{SCHEMA_ORG}/UsedCondition"


def format_price_ld(price: float | int | str | None) -> str | None:
    if price is None:
        return None
    try:
        amount = float(price)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    return f"{amount:.2f}"


def _strip_html(value: str | None) -> str:
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", text).strip()


def product_body_description(
    *,
    brand: str | None,
    article: str | None,
    name: str | None,
    unique_description: str | None,
    short_name: str | None = None,
    is_new: bool = False,
    max_len: int = 500,
) -> str:
    unique = _strip_html(unique_description)
    short = (short_name or "").strip()
    display = (name or "").strip()

    for candidate in (unique, short, display):
        if candidate and len(candidate) >= 20:
            if len(candidate) <= max_len:
                return candidate
            return f"{candidate[: max_len - 1].strip()}…"

    brand_text = (brand or "").strip()
    article_text = (article or "").strip()
    condition = "Новая" if is_new else "Б/у"
    if brand_text and article_text:
        fallback = f"{condition} автозапчасть {brand_text} {article_text}."
    elif article_text:
        fallback = f"{condition} автозапчасть {article_text}."
    else:
        fallback = f"{condition} автозапчасть."
    return fallback


def sanitize_json_ld(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for key, item in value.items():
            if item is None:
                continue
            sanitized = sanitize_json_ld(item)
            if sanitized is None:
                continue
            if isinstance(sanitized, str) and not sanitized.strip():
                continue
            if isinstance(sanitized, (list, dict)) and not sanitized:
                continue
            cleaned[key] = sanitized
        return cleaned
    if isinstance(value, list):
        items = [sanitize_json_ld(item) for item in value]
        return [item for item in items if item is not None and item != "" and item != {} and item != []]
    return value


def dumps_json_ld(obj: dict[str, Any] | None) -> str:
    if not obj:
        return ""
    return json.dumps(sanitize_json_ld(obj), ensure_ascii=False)


def build_offer_json_ld(
    *,
    canonical_url: str,
    price: str,
    in_stock: bool,
    is_new: bool,
    seller_name: str | None = None,
    seller_phone: str | None = None,
    seller_address: str | None = None,
    city: str | None = None,
) -> dict[str, Any]:
    city_name = (city or DEFAULT_CITY).strip() or DEFAULT_CITY
    offer: dict[str, Any] = {
        "@type": "Offer",
        "url": canonical_url,
        "priceCurrency": "RUB",
        "price": price,
        "availability": IN_STOCK if in_stock else OUT_OF_STOCK,
        "itemCondition": NEW_CONDITION if is_new else USED_CONDITION,
    }

    if seller_name or seller_phone or seller_address:
        seller: dict[str, Any] = {
            "@type": "Organization",
            "name": (seller_name or "Свой Гараж").strip() or "Свой Гараж",
        }
        phone_str = (seller_phone or "").strip()
        if phone_str:
            seller["telephone"] = phone_str
        address_str = (seller_address or "").strip()
        if address_str or city_name:
            seller["address"] = {
                "@type": "PostalAddress",
                "addressLocality": city_name,
                "addressCountry": "RU",
            }
            if address_str:
                seller["address"]["streetAddress"] = address_str
        offer["seller"] = seller

    return offer


def _product_has_working_photo(product) -> bool:
    for photo in product.photos or []:
        photo_url = str(getattr(photo, "photo_url", "") or "").strip()
        if photo_url:
            return True
    return False


def _catalog_product_image_url(product, site_origin: str) -> str | None:
    from app.services.yandex_feed_xml_service import _absolute_photo_url

    for photo in product.photos or []:
        raw_url = getattr(photo, "photo_url", None)
        if not raw_url:
            continue
        path = raw_url
        if not str(raw_url).startswith(("http://", "https://")):
            path = photo.full_url if hasattr(photo, "full_url") else raw_url
        image_url = _absolute_photo_url(path, site_origin)
        if image_url:
            return image_url
    return None


def is_catalog_product_json_ld_eligible(product) -> bool:
    if (product.quantity or 0) <= 0:
        return False
    brand = (product.brand or "").strip()
    if not brand:
        return False
    if not (product.article or "").strip():
        return False
    if not (product.name or "").strip():
        return False
    if not format_price_ld(product.price):
        return False
    return _product_has_working_photo(product)


def build_catalog_product_json_ld(
    product,
    *,
    site_origin: str,
    canonical_url: str,
    city: str | None = None,
) -> dict[str, Any] | None:
    if not is_catalog_product_json_ld_eligible(product):
        return None

    brand = (product.brand or "").strip()
    article = (product.article or "").strip()
    name = format_product_display_title(brand, article, product.name)
    short_name = extract_product_description(product.name, brand, article)
    unique_desc = _strip_html(product.description)
    image_url = _catalog_product_image_url(product, site_origin)
    if not image_url:
        return None

    price = format_price_ld(product.price)
    if not price:
        return None

    in_stock = (product.quantity or 0) > 0
    organization = getattr(product, "organization", None)
    org_name = getattr(organization, "name", None) if organization else None
    org_phone = getattr(organization, "phone", None) if organization else None
    org_address = getattr(organization, "address", None) if organization else None

    description = product_body_description(
        brand=brand,
        article=article,
        name=name,
        unique_description=unique_desc,
        short_name=short_name,
        is_new=bool(product.is_new),
    )

    product_json: dict[str, Any] = {
        "@context": SCHEMA_ORG,
        "@type": "Product",
        "name": name,
        "description": description,
        "sku": article,
        "mpn": article,
        "alternateName": build_product_alternate_names(brand=brand, article=article) or None,
        "brand": {"@type": "Brand", "name": brand},
        "manufacturer": {"@type": "Organization", "name": brand},
        "image": [image_url],
        "offers": build_product_offer_json_ld(
            canonical_url=canonical_url,
            price=price,
            in_stock=in_stock,
            is_new=bool(product.is_new),
            seller_name=str(org_name) if org_name is not None else None,
            seller_phone=str(org_phone) if org_phone is not None else None,
            seller_address=str(org_address) if org_address is not None else None,
            city=city,
        ),
    }
    return sanitize_json_ld(product_json)


def is_new_part_json_ld_eligible(card) -> bool:
    brand = str(getattr(card, "brand", "") or "").strip()
    article = str(getattr(card, "article", "") or "").strip()
    if not brand or not article:
        return False
    if not format_price_ld(getattr(card, "price", None)):
        return False
    name = str(getattr(card, "name", "") or "").strip()
    if not name and not f"{brand} {article}".strip():
        return False
    stock_count = int(getattr(card, "stock_count", 0) or 0)
    image_url = str(getattr(card, "image_url", "") or "").strip()
    return bool(image_url or stock_count > 0)


def build_new_part_card_json_ld(
    card,
    *,
    site_origin: str,
    canonical_url: str,
    display_price: float | int | str | None = None,
) -> dict[str, Any] | None:
    if not is_new_part_json_ld_eligible(card):
        return None

    from app.services.yandex_feed_xml_service import _absolute_photo_url

    brand = str(card.brand or "").strip()
    article = str(card.article or "").strip()
    display_name = str(card.name or "").strip() or f"{brand} {article}".strip()
    unique_desc = str(card.description or "").strip()
    description = product_body_description(
        brand=brand,
        article=article,
        name=display_name,
        unique_description=unique_desc,
        is_new=True,
    )

    image_url = _absolute_photo_url(str(card.image_url or "").strip(), site_origin)
    if not image_url:
        image_url = resolve_default_og_image_url(site_origin)

    price_source = display_price if display_price is not None else card.price
    price = format_price_ld(price_source)
    if not price:
        return None

    in_stock = int(card.stock_count or 0) > 0
    alternate_names = build_product_alternate_names(brand=brand, article=article)
    offers = build_product_offer_json_ld(
        canonical_url=canonical_url,
        price=price,
        in_stock=in_stock,
        is_new=True,
        seller_name=None,
        seller_phone=None,
        seller_address=None,
        city=DEFAULT_CITY,
    )
    if offers is None:
        offers = build_offer_json_ld(
            canonical_url=canonical_url,
            price=price,
            in_stock=in_stock,
            is_new=True,
        )
        offers["areaServed"] = {"@type": "Country", "name": "RU"}
        offers["shippingDetails"] = {
            "@type": "OfferShippingDetails",
            "shippingDestination": {
                "@type": "DefinedRegion",
                "addressCountry": "RU",
            },
        }
        offers["availableAtOrFrom"] = {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": DEFAULT_CITY,
                "addressCountry": "RU",
            },
        }
    product_json: dict[str, Any] = {
        "@context": SCHEMA_ORG,
        "@type": "Product",
        "name": display_name,
        "description": description,
        "sku": article,
        "mpn": article,
        "alternateName": alternate_names or None,
        "brand": {"@type": "Brand", "name": brand},
        "manufacturer": {"@type": "Organization", "name": brand},
        "image": [image_url],
        "offers": offers,
    }
    return sanitize_json_ld(product_json)
