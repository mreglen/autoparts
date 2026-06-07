from __future__ import annotations

from typing import Any


def _safe_text(value: object, default: str = "") -> str:
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip() or default
    if isinstance(value, (int, float)):
        return str(value)
    return default


def extract_rossko_parts(data: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not data:
        return []
    parts_list = (data.get("PartsList") or {}).get("Part")
    if not parts_list:
        return []
    if isinstance(parts_list, list):
        return [p for p in parts_list if isinstance(p, dict)]
    if isinstance(parts_list, dict):
        return [parts_list]
    return []


def _normalize_article(value: object) -> str:
    from app.utils.partnumber import normalize_partnumber

    return normalize_partnumber(_safe_text(value))


def get_rossko_stock_count(part: dict[str, Any]) -> int:
    stocks = (part.get("stocks") or {}).get("stock")
    if not stocks:
        return 0
    arr = stocks if isinstance(stocks, list) else [stocks]
    total = 0
    for stock in arr:
        if not isinstance(stock, dict):
            continue
        try:
            total += max(0, int(stock.get("count") or 0))
        except (TypeError, ValueError):
            continue
    return total


def get_rossko_min_price(part: dict[str, Any]) -> float:
    stocks = (part.get("stocks") or {}).get("stock")
    if not stocks:
        return 0.0
    arr = stocks if isinstance(stocks, list) else [stocks]
    min_price = 0.0
    for stock in arr:
        if not isinstance(stock, dict):
            continue
        try:
            price = float(stock.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        if price <= 0:
            continue
        min_price = price if min_price <= 0 else min(min_price, price)
    return min_price


def _score_rossko_part(part: dict[str, Any], query_article_norm: str, query_brand_lower: str) -> int:
    score = 0
    pn = _normalize_article(part.get("partnumber"))
    brand_lower = _safe_text(part.get("brand")).lower()

    if query_article_norm:
        if pn == query_article_norm:
            score += 100
        elif pn.startswith(query_article_norm) or query_article_norm.startswith(pn):
            score += 50
        elif query_article_norm in pn:
            score += 20

    if query_brand_lower:
        if brand_lower == query_brand_lower:
            score += 30
        elif query_brand_lower in brand_lower:
            score += 10

    if get_rossko_stock_count(part) > 0:
        score += 10

    if get_rossko_min_price(part) > 0:
        score += 5

    return score


def pick_best_rossko_part(
    data: dict[str, Any] | None,
    *,
    brand: str | None,
    article: str | None,
) -> dict[str, Any] | None:
    parts = extract_rossko_parts(data)
    if not parts:
        return None

    query_article_norm = _normalize_article(article)
    query_brand_lower = _safe_text(brand).lower()

    ranked: list[tuple[int, float, dict[str, Any]]] = []
    for part in parts:
        score = _score_rossko_part(part, query_article_norm, query_brand_lower)
        price = get_rossko_min_price(part)
        if get_rossko_stock_count(part) <= 0:
            continue
        ranked.append((score, price if price > 0 else float("inf"), part))

    if not ranked:
        return None

    ranked.sort(key=lambda row: (-row[0], row[1]))
    return ranked[0][2]


def map_rossko_stocks(part: dict[str, Any]) -> list[dict[str, Any]]:
    stocks = (part.get("stocks") or {}).get("stock")
    if not stocks:
        return []
    arr = stocks if isinstance(stocks, list) else [stocks]
    mapped: list[dict[str, Any]] = []
    for stock in arr:
        if not isinstance(stock, dict):
            continue
        stock_id = _safe_text(stock.get("id"))
        if not stock_id:
            continue
        try:
            price = float(stock.get("price") or 0)
        except (TypeError, ValueError):
            price = 0.0
        try:
            available_count = max(0, int(stock.get("count") or 0))
        except (TypeError, ValueError):
            available_count = 0
        if price <= 0 or available_count <= 0:
            continue
        mapped.append(
            {
                "stock_id": stock_id,
                "price": price,
                "available_count": available_count,
                "delivery_start": _safe_text(stock.get("deliveryStart")) or None,
                "delivery_end": _safe_text(stock.get("deliveryEnd")) or None,
            }
        )
    return mapped


def rossko_part_to_card_payload(part: dict[str, Any]) -> dict[str, Any]:
    brand = _safe_text(part.get("brand"), default="Неизвестный бренд")
    article = _safe_text(part.get("partnumber"), default="Без артикула")
    stocks = map_rossko_stocks(part)
    primary = stocks[0] if stocks else None
    name = _safe_text(part.get("name")) or _safe_text(part.get("description"))
    description = _safe_text(part.get("description")) or name
    stock_count = sum(int(s.get("available_count") or 0) for s in stocks)

    payload: dict[str, Any] = {
        "source": "rossko",
        "brand": brand,
        "article": article,
        "name": name or None,
        "description": description or None,
        "price": primary.get("price") if primary else None,
        "currency": "RUB",
        "stock_count": stock_count,
        "delivery_start": primary.get("delivery_start") if primary else None,
        "delivery_end": primary.get("delivery_end") if primary else None,
        "image_url": None,
        "guid": _safe_text(part.get("guid")) or None,
        "stocks": stocks,
    }
    if primary:
        payload["supplier_stock_id"] = primary.get("stock_id")
    return payload
