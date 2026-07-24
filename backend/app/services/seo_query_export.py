"""Build a plain-text SEO query list for Wordstat / SEO tools."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Iterable

from sqlalchemy.orm import Session

from app.services.analytics_query_review_service import get_latest_query_review
from app.services.site_analytics_service import get_popular_new_part_queries, get_product_cards

DEFAULT_EXPORT_LIMIT = 500
MAX_EXPORT_LIMIT = 1000
MAX_REAL_QUERIES = 100
PRODUCT_CARDS_LIMIT = 80
DEFAULT_DAYS = 30

# ~58% Екатеринбург when cycling through weighted list
PRIMARY_CITY = "Екатеринбург"
OTHER_RU_CITIES = (
    "Москва",
    "Санкт-Петербург",
    "Челябинск",
    "Тюмень",
    "Пермь",
    "Уфа",
    "Казань",
    "Новосибирск",
    "Самара",
    "Краснодар",
    "Нижний Новгород",
    "Ростов-на-Дону",
    "Омск",
    "Воронеж",
    "Красноярск",
    "Волгоград",
    "Саратов",
    "Ижевск",
    "Тольятти",
    "Барнаул",
)

# Repeat PRIMARY so weighted picks favor it (~25/45 ≈ 56%)
WEIGHTED_CITIES: tuple[str, ...] = (PRIMARY_CITY,) * 25 + OTHER_RU_CITIES


@dataclass(frozen=True)
class ProductSeed:
    name: str | None
    brand: str | None
    article: str | None


def normalize_query_key(text: str) -> str:
    return " ".join((text or "").strip().casefold().split())


def clean_query_display(text: str) -> str:
    return " ".join((text or "").strip().split())


def _city_for_index(index: int, cities: tuple[str, ...] = WEIGHTED_CITIES) -> str:
    if not cities:
        return PRIMARY_CITY
    return cities[index % len(cities)]


def collect_real_queries(db: Session, *, days: int = DEFAULT_DAYS, max_real: int = MAX_REAL_QUERIES) -> list[str]:
    """Popular on-site searches + latest Yandex query-review snapshot."""
    out: list[str] = []
    seen: set[str] = set()

    def _add(raw: str | None) -> None:
        display = clean_query_display(raw or "")
        if not display or len(display) < 2:
            return
        key = normalize_query_key(display)
        if key in seen:
            return
        seen.add(key)
        out.append(display)

    try:
        on_site, _generated_at = get_popular_new_part_queries(db, days=days, limit=20)
        for q in on_site:
            _add(q)
            if len(out) >= max_real:
                return out
    except Exception:
        pass

    try:
        snapshot = get_latest_query_review(db)
        if snapshot and snapshot.items:
            for item in snapshot.items:
                _add(getattr(item, "query", None))
                if len(out) >= max_real:
                    break
    except Exception:
        pass

    return out[:max_real]


def product_seeds_from_cards(db: Session, *, days: int = DEFAULT_DAYS, limit: int = PRODUCT_CARDS_LIMIT) -> list[ProductSeed]:
    cards = get_product_cards(db, days=days, limit=limit)
    seeds: list[ProductSeed] = []
    for row in cards.items:
        name = clean_query_display(row.name or "")
        brand = clean_query_display(row.brand or "")
        article = clean_query_display(row.article or "")
        if not name and not (brand and article):
            continue
        seeds.append(
            ProductSeed(
                name=name or None,
                brand=brand or None,
                article=article or None,
            )
        )
    return seeds


def generate_queries_for_product(
    seed: ProductSeed,
    *,
    start_index: int = 0,
    cities: tuple[str, ...] = WEIGHTED_CITIES,
) -> list[str]:
    """Many template variants for one product; cities cycle with Ekaterinburg bias."""
    name = seed.name
    brand = seed.brand
    article = seed.article
    variants: list[str] = []
    i = start_index

    def city() -> str:
        nonlocal i
        c = _city_for_index(i, cities)
        i += 1
        return c

    if name:
        variants.extend(
            [
                f"купить {name} в {city()}",
                f"{name} купить {city()}",
                f"б/у {name} {city()}",
                f"{name} недорого",
                f"заказать {name}",
                f"{name} с доставкой",
                f"{name} цена {city()}",
                f"купить б/у {name} в {city()}",
                f"{name} наличие {city()}",
                f"{name} наличие",
            ]
        )
    if brand and article:
        variants.extend(
            [
                f"{brand} {article} купить",
                f"{article} {brand} {PRIMARY_CITY}",
                f"купить {brand} {article} в {city()}",
                f"{brand} {article} {city()}",
            ]
        )
    if brand and name:
        variants.append(f"{brand} {name} купить в {city()}")
    if article and name:
        variants.append(f"{article} {name} {city()}")

    cleaned: list[str] = []
    seen: set[str] = set()
    for v in variants:
        display = clean_query_display(v)
        key = normalize_query_key(display)
        if not display or key in seen:
            continue
        seen.add(key)
        cleaned.append(display)
    return cleaned


def generate_from_products(
    seeds: Iterable[ProductSeed],
    *,
    need: int,
    cities: tuple[str, ...] = WEIGHTED_CITIES,
    exclude: set[str] | None = None,
) -> list[str]:
    if need <= 0:
        return []
    seen = set(exclude or ())
    out: list[str] = []
    city_cursor = 0
    for seed in seeds:
        variants = generate_queries_for_product(seed, start_index=city_cursor, cities=cities)
        city_cursor += max(1, len(variants))
        for q in variants:
            key = normalize_query_key(q)
            if key in seen:
                continue
            seen.add(key)
            out.append(q)
            if len(out) >= need:
                return out
    return out


def build_seo_queries_list(
    db: Session,
    *,
    limit: int = DEFAULT_EXPORT_LIMIT,
    days: int = DEFAULT_DAYS,
    cities: tuple[str, ...] = WEIGHTED_CITIES,
) -> list[str]:
    limit = max(1, min(int(limit), MAX_EXPORT_LIMIT))
    real = collect_real_queries(db, days=days, max_real=min(MAX_REAL_QUERIES, limit))
    seen = {normalize_query_key(q) for q in real}
    result = list(real)
    need = limit - len(result)
    if need > 0:
        seeds = product_seeds_from_cards(db, days=days, limit=PRODUCT_CARDS_LIMIT)
        generated = generate_from_products(seeds, need=need, cities=cities, exclude=seen)
        result.extend(generated)
    return result[:limit]


def build_seo_queries_export(
    db: Session,
    *,
    limit: int = DEFAULT_EXPORT_LIMIT,
    days: int = DEFAULT_DAYS,
) -> tuple[str, int, date]:
    queries = build_seo_queries_list(db, limit=limit, days=days)
    export_date = datetime.now(timezone.utc).date()
    content = "\n".join(queries)
    if queries:
        content += "\n"
    return content, len(queries), export_date
