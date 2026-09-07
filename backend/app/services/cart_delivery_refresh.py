"""Refresh new-parts cart delivery windows from live Rossko offers."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.carts import GuestNewPartsCart, NewPartsCart
from app.routers.rossko_api.rossko_api import (
    rossko_address_id,
    rossko_delivery_id,
    rossko_search,
)
from app.schemas.rossko import SearchRequest
from app.services.rossko_part_selection import (
    extract_rossko_parts,
    map_rossko_stocks,
    pick_best_rossko_part,
)

logger = logging.getLogger(__name__)


def _parse_dt(value: object) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


def _delivery_sort_key(stock: dict[str, Any]) -> tuple[float, float]:
    """Earlier delivery window first; prefer shorter windows as a tie-breaker."""
    start = _parse_dt(stock.get("delivery_start"))
    end = _parse_dt(stock.get("delivery_end"))
    start_ts = start.timestamp() if start else float("inf")
    end_ts = end.timestamp() if end else start_ts
    return (start_ts, end_ts)


def _normalize_stock_id(value: object) -> str:
    return str(value or "").strip()


def _fastest_stock_offer(
    search_data: dict[str, Any] | None,
    *,
    brand: str,
    partnumber: str,
    stock_id: str,
) -> dict[str, Any] | None:
    """Pick the fastest current delivery window for the given warehouse/stock."""
    target_stock_id = _normalize_stock_id(stock_id)
    if not target_stock_id or not search_data:
        return None

    # Prefer the best matching part, but always scan all parts/crosses for this stock_id.
    preferred = pick_best_rossko_part(
        search_data,
        brand=brand,
        article=partnumber,
        include_crosses=True,
    )
    parts = extract_rossko_parts(search_data, include_crosses=True)
    if preferred:
        preferred_guid = str(preferred.get("guid") or preferred.get("partnumber") or "")
        parts = sorted(
            parts,
            key=lambda row: 0
            if str(row.get("guid") or row.get("partnumber") or "") == preferred_guid
            else 1,
        )

    candidates: list[dict[str, Any]] = []
    for row in parts:
        for stock in map_rossko_stocks(row):
            if _normalize_stock_id(stock.get("stock_id")) != target_stock_id:
                continue
            if not stock.get("delivery_start") and not stock.get("delivery_end"):
                continue
            candidates.append(stock)

    if not candidates:
        return None
    candidates.sort(key=_delivery_sort_key)
    return candidates[0]


async def _search_rossko(db: Session, text: str) -> dict[str, Any] | None:
    query = (text or "").strip()
    if not query:
        return None
    try:
        return await rossko_search(
            SearchRequest(
                text=query,
                delivery_id=rossko_delivery_id,
                address_id=rossko_address_id,
            ),
            db,
        )
    except Exception:
        logger.exception("Rossko search failed while refreshing cart delivery for %r", query)
        return None


def _apply_delivery(cart_item, offer: dict[str, Any]) -> bool:
    start = _parse_dt(offer.get("delivery_start"))
    end = _parse_dt(offer.get("delivery_end"))
    if not start and not end:
        return False

    current_start = _parse_dt(getattr(cart_item, "delivery_start", None))
    current_end = _parse_dt(getattr(cart_item, "delivery_end", None))
    changed = False

    if start is not None and current_start != start:
        cart_item.delivery_start = start
        changed = True
    if end is not None and current_end != end:
        cart_item.delivery_end = end
        changed = True
    if changed:
        # Prefer structured dates over stale text fallback.
        if cart_item.delivery is not None:
            cart_item.delivery = None
        cart_item.updated_at = datetime.utcnow()
    return changed


async def refresh_user_cart_deliveries(
    db: Session,
    *,
    cart_id: int,
    user_id: int,
) -> int:
    rows = (
        db.query(NewPartsCart)
        .filter(NewPartsCart.cart_id == cart_id, NewPartsCart.user_id == user_id)
        .all()
    )
    return await _refresh_rows(db, rows)


async def refresh_guest_cart_deliveries(
    db: Session,
    *,
    guest_cart_id: int,
) -> int:
    rows = (
        db.query(GuestNewPartsCart)
        .filter(GuestNewPartsCart.guest_cart_id == guest_cart_id)
        .all()
    )
    return await _refresh_rows(db, rows)


async def _refresh_rows(db: Session, rows: list) -> int:
    if not rows:
        return 0

    queries: dict[str, list] = {}
    for row in rows:
        brand = str(getattr(row, "brand", "") or "").strip()
        partnumber = str(getattr(row, "partnumber", "") or "").strip()
        stock_id = _normalize_stock_id(getattr(row, "stock_id", ""))
        if not brand or not partnumber or not stock_id:
            continue
        key = partnumber
        queries.setdefault(key, []).append(row)

    if not queries:
        return 0

    search_cache: dict[str, dict[str, Any] | None] = {}

    async def cached_search(text: str) -> dict[str, Any] | None:
        normalized = (text or "").strip()
        if not normalized:
            return None
        if normalized not in search_cache:
            search_cache[normalized] = await _search_rossko(db, normalized)
            await asyncio.sleep(0)
        return search_cache[normalized]

    updated = 0
    for partnumber, group_rows in queries.items():
        primary_data = await cached_search(partnumber)
        for row in group_rows:
            brand = str(row.brand or "").strip()
            offer = _fastest_stock_offer(
                primary_data,
                brand=brand,
                partnumber=partnumber,
                stock_id=str(row.stock_id or ""),
            )
            if not offer and brand:
                alt_data = await cached_search(f"{brand} {partnumber}".strip())
                offer = _fastest_stock_offer(
                    alt_data,
                    brand=brand,
                    partnumber=partnumber,
                    stock_id=str(row.stock_id or ""),
                )
            if not offer:
                continue
            if _apply_delivery(row, offer):
                updated += 1
                logger.info(
                    "Cart delivery refreshed: %s %s stock=%s -> %s .. %s",
                    row.brand,
                    row.partnumber,
                    row.stock_id,
                    offer.get("delivery_start"),
                    offer.get("delivery_end"),
                )

    if updated:
        db.commit()
    return updated
