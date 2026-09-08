"""Refresh new-parts cart delivery windows from live Rossko offers."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
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
        logger.debug(f"No target_stock_id or search_data for {brand} {partnumber} stock_id={stock_id}")
        return None

    logger.debug(f"Searching for fastest stock offer: {brand} {partnumber} stock_id={target_stock_id}")

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
            current_stock_id = _normalize_stock_id(stock.get("stock_id"))
            if current_stock_id != target_stock_id:
                continue
            if not stock.get("delivery_start") and not stock.get("delivery_end"):
                continue
            candidates.append(stock)
            logger.debug(f"Found candidate: stock_id={current_stock_id} delivery_start={stock.get('delivery_start')} delivery_end={stock.get('delivery_end')}")

    if not candidates:
        logger.debug(f"No candidates found for {brand} {partnumber} stock_id={target_stock_id}")
        return None
    candidates.sort(key=_delivery_sort_key)
    fastest = candidates[0]
    logger.debug(f"Fastest stock for {brand} {partnumber} stock_id={target_stock_id}: delivery_start={fastest.get('delivery_start')} delivery_end={fastest.get('delivery_end')}")
    return fastest


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


def _apply_delivery(cart_item, offer: dict[str, Any] | None) -> bool:
    """Apply delivery offer to cart item. If offer is None, clear delivery dates (out of stock)."""
    if offer is None:
        # Товара нет на складе - очищаем даты доставки
        current_start = _parse_dt(getattr(cart_item, "delivery_start", None))
        current_end = _parse_dt(getattr(cart_item, "delivery_end", None))
        changed = False

        logger.debug(f"Marking item as out of stock: {getattr(cart_item, 'brand', '')} {getattr(cart_item, 'partnumber', '')} stock_id={getattr(cart_item, 'stock_id', '')}")

        if current_start is not None:
            cart_item.delivery_start = None
            changed = True
        if current_end is not None:
            cart_item.delivery_end = None
            changed = True

        if changed:
            cart_item.delivery = "нет в наличии"
            cart_item.updated_at = datetime.now(timezone.utc)
            logger.info(f"Item marked out of stock: {getattr(cart_item, 'brand', '')} {getattr(cart_item, 'partnumber', '')} stock_id={getattr(cart_item, 'stock_id', '')}")
        return changed
    
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
        cart_item.updated_at = datetime.now(timezone.utc)
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

    logger.info(f"Starting delivery refresh for {len(rows)} cart items")

    queries: dict[str, list] = {}
    for row in rows:
        brand = str(getattr(row, "brand", "") or "").strip()
        partnumber = str(getattr(row, "partnumber", "") or "").strip()
        stock_id = _normalize_stock_id(getattr(row, "stock_id", ""))
        if not brand or not partnumber or not stock_id:
            logger.debug(f"Skipping row with missing data: brand={brand} partnumber={partnumber} stock_id={stock_id}")
            continue
        key = partnumber
        queries.setdefault(key, []).append(row)

    if not queries:
        logger.warning("No valid queries to process")
        return 0

    logger.info(f"Processing {len(queries)} unique partnumbers")

    search_cache: dict[str, dict[str, Any] | None] = {}

    async def cached_search(text: str) -> dict[str, Any] | None:
        normalized = (text or "").strip()
        if not normalized:
            return None
        if normalized not in search_cache:
            logger.debug(f"Searching Rossko for: {normalized}")
            search_cache[normalized] = await _search_rossko(db, normalized)
            await asyncio.sleep(0)
        return search_cache[normalized]

    updated = 0
    for partnumber, group_rows in queries.items():
        logger.debug(f"Processing partnumber: {partnumber} with {len(group_rows)} items")
        primary_data = await cached_search(partnumber)
        for row in group_rows:
            brand = str(row.brand or "").strip()
            logger.debug(f"Processing item: {brand} {partnumber} stock_id={row.stock_id}")
            offer = _fastest_stock_offer(
                primary_data,
                brand=brand,
                partnumber=partnumber,
                stock_id=str(row.stock_id or ""),
            )
            if not offer and brand:
                logger.debug(f"No offer found with primary search, trying alternative: {brand} {partnumber}")
                alt_data = await cached_search(f"{brand} {partnumber}".strip())
                offer = _fastest_stock_offer(
                    alt_data,
                    brand=brand,
                    partnumber=partnumber,
                    stock_id=str(row.stock_id or ""),
                )
            # Если offer не найден, передаем None чтобы обозначить "нет в наличии"
            if _apply_delivery(row, offer):
                updated += 1
                if offer:
                    logger.info(
                        "Cart delivery refreshed: %s %s stock=%s -> %s .. %s",
                        row.brand,
                        row.partnumber,
                        row.stock_id,
                        offer.get("delivery_start"),
                        offer.get("delivery_end"),
                    )
                else:
                    logger.info(
                        "Cart item marked out of stock: %s %s stock=%s",
                        row.brand,
                        row.partnumber,
                        row.stock_id,
                    )

    logger.info(f"Delivery refresh completed: {updated} items updated")
    if updated:
        db.commit()
    return updated
