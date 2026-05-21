"""
Warehouse fulfillment status for closed Avito orders (stage 4).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models.avito_orders_cache import AvitoOrderCache
from app.models.stock_out import StockOut
from app.services.avito_order_pricing import avito_order_items

FULFILLMENT_PENDING = "pending"
FULFILLMENT_PARTIAL = "partial"
FULFILLMENT_FULFILLED = "fulfilled"
FULFILLMENT_FAILED = "failed"

SKIP_REASON_LABELS: dict[str, str] = {
    "already_processed": "Заказ уже полностью проведён на складе",
    "no_items": "В заказе нет позиций",
    "listing_not_found": "Товар не привязан к объявлению Авито",
    "product_not_found": "Товар не найден в каталоге",
    "missing_storage_location": "У товара не указана ячейка склада",
    "zero_price": "Нет цены в заказе Авито и в карточке товара",
    "insufficient_quantity": "Недостаточно товара на складе",
    "stock_out_error": "Ошибка списания со склада",
    "item_processing_error": "Ошибка обработки позиции",
}


def _normalize_status(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def count_expected_items(order: AvitoOrderCache) -> int:
    items = avito_order_items(order.avito_data)
    return len([it for it in items if isinstance(it, dict)])


def load_stock_outs_for_order(db: Session, order: AvitoOrderCache) -> list[StockOut]:
    if not order.avito_order_id:
        return []
    return (
        db.query(StockOut)
        .filter(
            StockOut.organization_id == order.organization_id,
            StockOut.avito_order_id == str(order.avito_order_id),
        )
        .all()
    )


def load_stock_outs_for_orders(
    db: Session,
    orders: list[AvitoOrderCache],
) -> dict[tuple[str, str], list[StockOut]]:
    """Batch-load stock_out rows keyed by (organization_id, avito_order_id)."""
    if not orders:
        return {}

    org_ids = {o.organization_id for o in orders}
    avito_ids = {str(o.avito_order_id) for o in orders if o.avito_order_id}
    if not avito_ids:
        return {}

    rows = (
        db.query(StockOut)
        .filter(
            StockOut.organization_id.in_(org_ids),
            StockOut.avito_order_id.in_(avito_ids),
        )
        .all()
    )
    grouped: dict[tuple[str, str], list[StockOut]] = {}
    for row in rows:
        key = (row.organization_id, str(row.avito_order_id))
        grouped.setdefault(key, []).append(row)
    return grouped


def _stock_out_total_amount(stock_outs: list[StockOut]) -> float:
    total = 0.0
    for so in stock_outs:
        try:
            price = float(so.sale_price or 0)
            qty = int(so.quantity or 0)
        except (TypeError, ValueError):
            price, qty = 0.0, 0
        total += price * max(qty, 0)
    return total


def derive_fulfillment_status(
    *,
    is_closed: bool,
    expected_item_count: int,
    stock_out_count: int,
    skip_count: int = 0,
    persisted_status: Optional[str] = None,
) -> str:
    if not is_closed:
        return persisted_status or FULFILLMENT_PENDING

    if expected_item_count <= 0:
        return FULFILLMENT_FAILED if skip_count else FULFILLMENT_PENDING

    if stock_out_count >= expected_item_count:
        return FULFILLMENT_FULFILLED
    if stock_out_count > 0:
        return FULFILLMENT_PARTIAL
    if skip_count > 0:
        return FULFILLMENT_FAILED
    return persisted_status or FULFILLMENT_PENDING


def compute_warehouse_fulfillment(
    db: Session,
    order: AvitoOrderCache,
    *,
    stock_outs: Optional[list[StockOut]] = None,
) -> dict[str, Any]:
    if stock_outs is None:
        stock_outs = load_stock_outs_for_order(db, order)

    expected = count_expected_items(order)
    stock_out_count = len(stock_outs)
    is_closed = _normalize_status(order.avito_status_code) == "closed"

    skip_reasons = order.last_skip_reasons if isinstance(order.last_skip_reasons, list) else []
    skip_count = len(skip_reasons)

    status = derive_fulfillment_status(
        is_closed=is_closed,
        expected_item_count=expected,
        stock_out_count=stock_out_count,
        skip_count=skip_count,
        persisted_status=order.stock_fulfillment_status,
    )

    mismatch = is_closed and status != FULFILLMENT_FULFILLED
    can_retry = is_closed and status != FULFILLMENT_FULFILLED

    return {
        "status": status,
        "expected_item_count": expected,
        "stock_out_count": stock_out_count,
        "stock_out_total_amount": _stock_out_total_amount(stock_outs),
        "mismatch": mismatch,
        "can_retry": can_retry,
        "skip_reasons": skip_reasons,
        "last_fulfillment_at": order.last_fulfillment_at,
    }


def make_skip_reason(
    code: str,
    *,
    message: Optional[str] = None,
    avito_item_id: Any = None,
    product_id: Optional[int] = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {"code": code}
    if message:
        entry["message"] = message
    if avito_item_id is not None:
        entry["avito_item_id"] = avito_item_id
    if product_id is not None:
        entry["product_id"] = product_id
    return entry


def update_fulfillment_fields(
    order: AvitoOrderCache,
    process_result: dict[str, Any],
    *,
    db: Optional[Session] = None,
) -> None:
    """Persist fulfillment status after processor/sync/retry."""
    skipped_reasons = process_result.get("skipped_reasons") or []
    if not isinstance(skipped_reasons, list):
        skipped_reasons = []

    expected = count_expected_items(order)
    is_closed = _normalize_status(order.avito_status_code) == "closed"

    stock_out_count = int(process_result.get("stock_out_count", 0))
    if db is not None:
        stock_out_count = len(load_stock_outs_for_order(db, order))

    status = derive_fulfillment_status(
        is_closed=is_closed,
        expected_item_count=expected,
        stock_out_count=stock_out_count,
        skip_count=len(skipped_reasons),
        persisted_status=order.stock_fulfillment_status,
    )

    order.stock_fulfillment_status = status
    order.last_skip_reasons = skipped_reasons
    order.last_fulfillment_at = datetime.now(tz=timezone.utc)
    order.closed_processed = status == FULFILLMENT_FULFILLED


def enrich_avito_orders_response(
    db: Session,
    orders: list[AvitoOrderCache],
) -> list[dict[str, Any]]:
    """Build API payloads with computed warehouse_fulfillment."""
    stock_out_map = load_stock_outs_for_orders(db, orders)
    result: list[dict[str, Any]] = []

    for order in orders:
        key = (order.organization_id, str(order.avito_order_id))
        stock_outs = stock_out_map.get(key, [])
        wf = compute_warehouse_fulfillment(db, order, stock_outs=stock_outs)
        result.append(
            {
                "id": order.id,
                "organization_id": order.organization_id,
                "avito_order_id": order.avito_order_id,
                "avito_status_code": order.avito_status_code,
                "avito_data": order.avito_data,
                "total_amount": order.total_amount,
                "is_paid": order.is_paid,
                "created_at": order.created_at,
                "closed_processed": bool(order.closed_processed),
                "warehouse_fulfillment": wf,
            }
        )
    return result
