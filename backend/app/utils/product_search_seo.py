from __future__ import annotations

import re

from app.utils.organization_city import DEFAULT_CITY, extract_city_from_address, format_city_in_prepositional
from app.utils.product_display_name import format_product_display_title

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


def _build_listing_context_suffix(
    *,
    seller_name: str | None = None,
    listing_id: int | None = None,
) -> str:
    seller = (seller_name or "").strip()
    parts: list[str] = []
    if seller:
        parts.append(seller)
    if listing_id is not None:
        parts.append(f"№{int(listing_id)}")
    if not parts:
        return ""
    return f" — {' '.join(parts)}"


def _append_listing_uniqueness(
    base: str,
    *,
    seller_name: str | None = None,
    listing_id: int | None = None,
    max_len: int = 160,
) -> str:
    seller = (seller_name or "").strip()
    tail_parts: list[str] = []
    if seller:
        tail_parts.append(f"Продавец: {seller}.")
    if listing_id is not None:
        tail_parts.append(f"Объявление №{int(listing_id)}.")
    if not tail_parts:
        return _truncate(base, max_len)

    tail = " ".join(tail_parts)
    combined = f"{base} {tail}"
    if len(combined) <= max_len:
        return combined

    remaining = max_len - len(tail) - 1
    if remaining > 40:
        return f"{_truncate(base, remaining)} {tail}"
    return _truncate(combined, max_len)


def _build_title_core(
    *,
    brand: str | None,
    article: str | None,
    product_name: str | None = None,
    fallback_display_name: str | None = None,
) -> str:
    brand_str = (brand or "").strip()
    article_str = (article or "").strip()
    if brand_str or article_str:
        raw = (product_name or "").strip() or None
        return format_product_display_title(brand_str, article_str, raw)

    fallback = (fallback_display_name or "").strip()
    if fallback:
        return fallback
    raw = (product_name or "").strip()
    return raw or "Автозапчасть"


def _fit_core_with_suffix(core: str, suffix: str, max_len: int) -> str:
    core = re.sub(r"\s+", " ", (core or "")).strip()
    suffix = suffix or ""
    if not suffix:
        return _truncate(core, max_len)

    combined = f"{core}{suffix}"
    if len(combined) <= max_len:
        return combined

    allowed_core = max_len - len(suffix)
    if allowed_core < 1:
        return _truncate(combined, max_len)
    return f"{_truncate(core, allowed_core)}{suffix}"


def build_product_search_title(
    *,
    brand: str | None,
    article: str | None,
    product_name: str | None = None,
    fallback_display_name: str | None = None,
    seller_name: str | None = None,
    listing_id: int | None = None,
) -> str:
    core = _build_title_core(
        brand=brand,
        article=article,
        product_name=product_name,
        fallback_display_name=fallback_display_name,
    )
    suffix = _build_listing_context_suffix(seller_name=seller_name, listing_id=listing_id)
    max_core_len = max(20, 70 - len(_TITLE_SUFFIX))
    core_with_suffix = _fit_core_with_suffix(core, suffix, max_core_len)
    title = f"{core_with_suffix}{_TITLE_SUFFIX}"
    return re.sub(r"\s+", " ", title).strip()


def build_new_part_h1(
    *,
    brand: str | None,
    article: str | None,
    raw_name: str | None,
) -> str:
    brand_str = (brand or "").strip()
    article_str = (article or "").strip()
    raw = (raw_name or "").strip()
    if brand_str and article_str:
        prefix = f"{brand_str} {article_str}"
        if raw:
            raw_cf = raw.casefold()
            prefix_cf = prefix.casefold()
            if raw_cf.startswith(prefix_cf):
                tail = raw[len(prefix) :].strip(" -—")
                if tail:
                    return f"{prefix} — {tail}"
            if prefix_cf in raw_cf and raw != prefix:
                return raw
            return f"{prefix} — {raw}"
        return prefix
    if raw:
        return raw
    return "Автозапчасть"


def build_new_part_search_title(
    *,
    brand: str | None,
    article: str | None,
    raw_name: str | None,
    card_id: int,
    price: float | int | str | None = None,
) -> str:
    core = _build_title_core(brand=brand, article=article, product_name=raw_name)
    price_text = _format_price_rub(price)
    price_part = f" от {price_text} ₽" if price_text else ""
    suffix = f"{price_part} — новая №{int(card_id)}"
    max_core_len = max(20, 70 - len(_TITLE_SUFFIX))
    core_with_suffix = _fit_core_with_suffix(core, suffix, max_core_len)
    title = f"{core_with_suffix}{_TITLE_SUFFIX}"
    return re.sub(r"\s+", " ", title).strip()


def build_new_part_search_description(
    *,
    brand: str | None,
    article: str | None,
    raw_name: str | None = None,
    card_id: int,
    price: float | int | str | None = None,
    in_stock: bool = True,
    city: str | None = None,
    unique_description: str | None = None,
) -> str:
    from app.utils.product_display_name import extract_product_description

    short_name = extract_product_description(raw_name, brand, article)
    return build_product_search_description(
        brand=brand,
        article=article,
        is_new=True,
        city=city or DEFAULT_CITY,
        price=price,
        in_stock=in_stock,
        short_name=short_name,
        unique_description=unique_description,
        listing_id=card_id,
    )


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
    seller_name: str | None = None,
    listing_id: int | None = None,
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
            return _append_listing_uniqueness(
                combined,
                seller_name=seller_name,
                listing_id=listing_id,
            )
        remaining = 160 - len(f"{base} ") - 1
        if remaining > 20:
            snippet = _truncate(snippet_source, remaining)
            return _append_listing_uniqueness(
                f"{base} {snippet}",
                seller_name=seller_name,
                listing_id=listing_id,
            )
    return _append_listing_uniqueness(
        _truncate(base, 160),
        seller_name=seller_name,
        listing_id=listing_id,
    )


def build_product_seo_summary(
    *,
    brand: str | None,
    article: str | None,
    name: str | None = None,
    is_new: bool = False,
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
    label = f"{brand_str} {article_str}".strip() or (name or "").strip() or "автозапчасть"
    stock_phrase = "в наличии" if in_stock else "доступна"
    price_text = _format_price_rub(price)
    price_part = f" Цена {price_text} ₽." if price_text else ""
    snippet = _merge_content_snippet(short_name=short_name, unique_description=unique_description, max_len=120)
    detail = f" {snippet}." if snippet else ""
    return f"{condition} автозапчасть {label} {stock_phrase} в {city_prep}.{price_part}{detail}".replace("  ", " ").strip()


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
