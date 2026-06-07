from __future__ import annotations

import re

from app.utils.organization_city import DEFAULT_CITY, extract_city_from_address, format_city_in_prepositional

SITE_BRAND = "Свой Гараж"
_TITLE_SUFFIX = f" | {SITE_BRAND}"


def _truncate(text: str, max_len: int) -> str:
    value = re.sub(r"\s+", " ", (text or "")).strip()
    if not value:
        return ""
    if len(value) <= max_len:
        return value
    return f"{value[: max_len - 1].strip()}…"


def _format_price_rub(price: float | int | str | None) -> str | None:
    if price is None:
        return None
    try:
        amount = float(price)
    except (TypeError, ValueError):
        return None
    if amount <= 0:
        return None
    if amount.is_integer():
        return f"{int(amount):,}".replace(",", " ")
    return f"{amount:,.2f}".replace(",", " ")


def _merge_content_snippet(
    *,
    short_name: str | None,
    unique_description: str | None,
    max_len: int = 120,
) -> str:
    short = re.sub(r"\s+", " ", (short_name or "")).strip()
    unique = re.sub(r"\s+", " ", (unique_description or "")).strip()

    parts: list[str] = []
    if short:
        parts.append(short)
    if unique and unique.casefold() not in short.casefold():
        parts.append(unique)

    if not parts:
        return ""
    merged = ". ".join(parts)
    if len(merged) <= max_len:
        return merged
    return _truncate(merged, max_len)


def build_product_search_title(
    *,
    brand: str | None,
    article: str | None,
    fallback_display_name: str | None = None,
) -> str:
    brand_str = (brand or "").strip()
    article_str = (article or "").strip()
    fallback = (fallback_display_name or "").strip()

    if fallback:
        core = fallback
    elif brand_str and article_str:
        core = f"{brand_str} {article_str}"
    elif article_str:
        core = article_str
    elif brand_str:
        core = brand_str
    else:
        core = "Автозапчасть"

    title = f"{core}{_TITLE_SUFFIX}"
    return re.sub(r"\s+", " ", title).strip()


def build_product_search_description(
    *,
    brand: str | None,
    article: str | None,
    is_new: bool,
    city: str | None = None,
    price: float | int | str | None = None,
    in_stock: bool = True,
    short_name: str | None = None,
    unique_description: str | None = None,
) -> str:
    brand_str = (brand or "").strip()
    article_str = (article or "").strip()
    condition = "Новая" if is_new else "Б/у"
    city_prep = format_city_in_prepositional(city or DEFAULT_CITY)
    snippet_source = _merge_content_snippet(
        short_name=short_name,
        unique_description=unique_description,
    )

    if brand_str and article_str:
        buy_line = f"Купить {brand_str} {article_str}."
    elif article_str:
        buy_line = f"Купить запчасть {article_str}."
    else:
        buy_line = "Купить автозапчасть."

    stock_phrase = "в наличии" if in_stock else "доступна"
    core = f"{buy_line} {condition} запчасть {stock_phrase} в {city_prep}."
    price_text = _format_price_rub(price)
    if price_text:
        core = f"{core} {price_text} ₽."
    delivery = "Доставка по России."

    base = f"{core} {delivery}"
    if snippet_source:
        combined = f"{base} {snippet_source}"
        if len(combined) <= 160:
            return combined
        remaining = 160 - len(f"{base} ") - 1
        if remaining > 20:
            snippet = _truncate(snippet_source, remaining)
            return f"{base} {snippet}"
    return _truncate(base, 160)


def build_product_alternate_names(*, brand: str | None, article: str | None) -> list[str]:
    brand_str = (brand or "").strip()
    article_str = (article or "").strip()
    if not article_str:
        return []

    names = [article_str]
    if brand_str:
        names.append(f"{brand_str} {article_str}")
        names.append(f"{article_str} {brand_str}")

    seen: set[str] = set()
    result: list[str] = []
    for name in names:
        key = name.casefold()
        if key not in seen:
            seen.add(key)
            result.append(name)
    return result


def resolve_product_city(*, organization_address: str | None) -> str:
    return extract_city_from_address(organization_address)


def build_product_offer_json_ld(
    *,
    canonical_url: str,
    price: str | None,
    in_stock: bool,
    is_new: bool,
    seller_name: str | None,
    seller_phone: str | None,
    seller_address: str | None,
    city: str | None,
) -> dict | None:
    from app.utils.product_json_ld import build_offer_json_ld, format_price_ld

    price_str = format_price_ld(price)
    if not price_str:
        return None

    city_name = city or DEFAULT_CITY
    offer = build_offer_json_ld(
        canonical_url=canonical_url,
        price=price_str,
        in_stock=in_stock,
        is_new=is_new,
        seller_name=seller_name,
        seller_phone=seller_phone,
        seller_address=seller_address,
        city=city_name,
    )
    offer["areaServed"] = {"@type": "Country", "name": "RU"}
    offer["shippingDetails"] = {
        "@type": "OfferShippingDetails",
        "shippingDestination": {
            "@type": "DefinedRegion",
            "addressCountry": "RU",
        },
    }
    offer["availableAtOrFrom"] = {
        "@type": "Place",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": city_name,
            "addressCountry": "RU",
        },
    }
    return offer
