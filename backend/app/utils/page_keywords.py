from __future__ import annotations

import re

from app.utils.organization_city import DEFAULT_CITY
from app.utils.product_search_seo import build_product_alternate_names

MAX_KEYWORDS = 12
MAX_PHRASE_LEN = 40


def _normalize_phrase(phrase: str) -> str:
    return re.sub(r"\s+", " ", (phrase or "")).strip()


def _truncate_phrase(phrase: str, *, max_len: int = MAX_PHRASE_LEN) -> str:
    value = _normalize_phrase(phrase)
    if not value:
        return ""
    if len(value) <= max_len:
        return value
    return value[: max_len - 1].rstrip()


def _join_keywords(phrases: list[str]) -> str:
    seen: set[str] = set()
    unique: list[str] = []
    for phrase in phrases:
        normalized = _truncate_phrase(phrase)
        if not normalized:
            continue
        key = normalized.casefold()
        if key in seen:
            continue
        seen.add(key)
        unique.append(normalized)
        if len(unique) >= MAX_KEYWORDS:
            break
    return ", ".join(unique)


def _product_part_keywords(*, brand: str, article: str, city: str | None, used: bool) -> str:
    brand_text = _normalize_phrase(brand)
    article_text = _normalize_phrase(article)
    city_text = _normalize_phrase(city or DEFAULT_CITY).casefold()
    phrases: list[str] = []

    for name in build_product_alternate_names(brand=brand_text, article=article_text):
        phrases.append(name)
        phrases.append(f"{name} купить")
        phrases.append(f"{name} цена")

    if brand_text and article_text:
        condition = "б/у" if used else "новая"
        phrases.append(f"{condition} {brand_text} {article_text}")
        phrases.append(f"автозапчасть {brand_text}")
    elif article_text:
        phrases.append(f"автозапчасть {article_text}")

    if used:
        phrases.append(f"купить б/у {city_text}")
    else:
        phrases.append("купить с доставкой")
        if brand_text:
            phrases.append(f"новая запчасть {brand_text}")
            phrases.append(f"{brand_text} автозапчасти")

    return _join_keywords(phrases)


def build_product_used_keywords(
    *,
    brand: str | None = None,
    article: str | None = None,
    city: str | None = None,
) -> str:
    return _product_part_keywords(
        brand=str(brand or ""),
        article=str(article or ""),
        city=city,
        used=True,
    )


def build_used_catalog_q_keywords(
    *,
    brand: str | None = None,
    article: str | None = None,
) -> str:
    return build_product_used_keywords(brand=brand, article=article, city=None)


def build_new_part_card_keywords(
    *,
    brand: str | None = None,
    article: str | None = None,
) -> str:
    return _product_part_keywords(
        brand=str(brand or ""),
        article=str(article or ""),
        city=None,
        used=False,
    )


def build_brand_used_keywords(*, brand_name: str | None) -> str:
    brand = _normalize_phrase(brand_name)
    if not brand:
        return ""
    city = DEFAULT_CITY.casefold()
    return _join_keywords(
        [
            f"б/у запчасти {brand}",
            f"{brand} автозапчасти",
            f"запчасти {brand} б/у",
            f"купить {brand} б/у",
            f"{brand} {city}",
            f"автозапчасти {brand}",
        ]
    )


def build_brand_new_keywords(*, brand_name: str | None) -> str:
    brand = _normalize_phrase(brand_name)
    if not brand:
        return ""
    return _join_keywords(
        [
            f"новые запчасти {brand}",
            f"{brand} автозапчасти",
            f"купить {brand}",
            f"{brand} оригинал",
            f"{brand} с доставкой",
            f"запчасти {brand} новые",
        ]
    )


def build_category_used_keywords(
    *,
    title_ru: str | None = None,
    search_query: str | None = None,
) -> str:
    title = _normalize_phrase(title_ru)
    query = _normalize_phrase(search_query) or title
    if not query and not title:
        return ""
    label = title or query
    return _join_keywords(
        [
            f"б/у {label}",
            f"{query} купить",
            f"купить б/у {label}",
            f"автозапчасти {label}",
            f"{label} б/у екатеринбург",
        ]
    )


def build_category_new_keywords(
    *,
    title_ru: str | None = None,
    search_query: str | None = None,
) -> str:
    title = _normalize_phrase(title_ru)
    query = _normalize_phrase(search_query) or title
    if not query and not title:
        return ""
    label = title or query
    return _join_keywords(
        [
            f"новые {label}",
            f"{query} купить",
            f"купить {label} с доставкой",
            f"автозапчасти {label}",
            f"{label} новые запчасти",
        ]
    )


def build_geo_used_keywords(*, city: str | None = None) -> str:
    city_text = _normalize_phrase(city or DEFAULT_CITY)
    city_lower = city_text.casefold()
    return _join_keywords(
        [
            f"б/у запчасти {city_lower}",
            f"автозапчасти {city_lower}",
            f"разборка {city_lower}",
            f"купить б/у {city_lower}",
            f"запчасти {city_lower}",
        ]
    )


def build_page_keywords(page_type: str, **context: str | None) -> str:
    builders = {
        "product_used": lambda: build_product_used_keywords(
            brand=context.get("brand"),
            article=context.get("article"),
            city=context.get("city"),
        ),
        "used_catalog_q": lambda: build_used_catalog_q_keywords(
            brand=context.get("brand"),
            article=context.get("article"),
        ),
        "new_part_card": lambda: build_new_part_card_keywords(
            brand=context.get("brand"),
            article=context.get("article"),
        ),
        "brand_used": lambda: build_brand_used_keywords(brand_name=context.get("brand_name")),
        "brand_new": lambda: build_brand_new_keywords(brand_name=context.get("brand_name")),
        "category_used": lambda: build_category_used_keywords(
            title_ru=context.get("title_ru"),
            search_query=context.get("search_query"),
        ),
        "category_new": lambda: build_category_new_keywords(
            title_ru=context.get("title_ru"),
            search_query=context.get("search_query"),
        ),
        "geo_used": lambda: build_geo_used_keywords(city=context.get("city")),
    }
    builder = builders.get(page_type)
    if builder is None:
        return ""
    return builder()
