"""
Финансовые отчёты по данным платформы (stock_out / stock_in).
Согласовано с логикой warehouse-sales в stock_out_sales.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.product import Product
from app.models.stock_in import StockIn
from app.models.stock_out import StockOut
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.services.stock_out_sales import (
    _warehouse_sale_filters,
    enrich_warehouse_sale_prices,
    is_warehouse_sale,
    warehouse_sales_totals,
)


def _finance_sales_query_options():
    return (
        joinedload(StockOut.product),
        joinedload(StockOut.garage_used_order_item).joinedload(GarageUsedOrderItem.order),
    )


CHANNEL_AVITO = "avito"
CHANNEL_MARKETPLACE_USED = "marketplace_used"
CHANNEL_WAREHOUSE = "warehouse_manual"
CHANNEL_ALL = "all"

CHANNEL_LABELS = {
    CHANNEL_AVITO: "Авито",
    CHANNEL_MARKETPLACE_USED: "Сайт (Б/У)",
    CHANNEL_WAREHOUSE: "Склад",
}

@dataclass(frozen=True)
class FinanceFilters:
    date_from: date
    date_to: date
    as_of_date: date
    channel: str = CHANNEL_ALL


def resolve_sale_channel(row: StockOut) -> str:
    source_kind = (getattr(row, "source_kind", None) or "").strip().lower()
    sale_channel = (row.sale_channel or "").strip().lower()

    if source_kind == CHANNEL_AVITO or sale_channel == CHANNEL_AVITO or row.avito_order_id:
        return CHANNEL_AVITO
    if (
        source_kind == CHANNEL_MARKETPLACE_USED
        or sale_channel == CHANNEL_MARKETPLACE_USED
        or getattr(row, "garage_used_order_item_id", None)
    ):
        return CHANNEL_MARKETPLACE_USED
    return CHANNEL_WAREHOUSE


def _marketplace_used_order_is_paid(row: StockOut) -> bool:
    """Сайт (Б/У) попадает в финансы только после подтверждения оплаты."""
    item = getattr(row, "garage_used_order_item", None)
    order = getattr(item, "order", None) if item is not None else None
    if order is not None:
        return bool(getattr(order, "is_paid", False))
    # Fallback: payment_method on stock_out set only after mark-paid
    return bool(getattr(row, "payment_method", None))


def _include_finance_sale_row(row: StockOut, channel: str) -> bool:
    if channel != CHANNEL_MARKETPLACE_USED:
        return True
    return _marketplace_used_order_is_paid(row)


def _payment_method_for_row(row: StockOut) -> Optional[str]:
    if getattr(row, "payment_method", None):
        return row.payment_method
    item = getattr(row, "garage_used_order_item", None)
    order = getattr(item, "order", None) if item is not None else None
    if order is not None and getattr(order, "is_paid", False):
        return getattr(order, "payment_method_name", None)
    return None


def _line_total(unit_price: float, quantity: int) -> float:
    try:
        return float(unit_price) * max(int(quantity or 0), 0)
    except (TypeError, ValueError):
        return 0.0


def _product_fields(product: Optional[Product]) -> dict[str, Any]:
    if not product:
        return {
            "product_id": None,
            "article": None,
            "internal_code": None,
            "name": None,
            "brand": None,
        }
    return {
        "product_id": product.id,
        "article": product.article,
        "internal_code": product.internal_code,
        "name": product.name,
        "brand": product.brand,
    }


def _stock_out_date_filters(date_from: date, date_to: date):
    return (
        StockOut.movement_date >= date_from,
        StockOut.movement_date <= date_to,
    )


def list_finance_sales(
    db: Session,
    organization_id: str,
    filters: FinanceFilters,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows = (
        db.query(StockOut)
        .options(*_finance_sales_query_options())
        .filter(
            *_warehouse_sale_filters(organization_id),
            *_stock_out_date_filters(filters.date_from, filters.date_to),
        )
        .order_by(StockOut.movement_date.desc(), StockOut.id.desc())
        .all()
    )
    rows = enrich_warehouse_sale_prices(db, rows, persist_fixes=False)

    result_rows: list[dict[str, Any]] = []
    included_rows: list[StockOut] = []
    for row in rows:
        if not is_warehouse_sale(row):
            continue
        channel = resolve_sale_channel(row)
        if filters.channel != CHANNEL_ALL and channel != filters.channel:
            continue
        if not _include_finance_sale_row(row, channel):
            continue

        try:
            unit_price = float(row.sale_price or 0)
        except (TypeError, ValueError):
            unit_price = 0.0
        qty = int(row.quantity or 0)
        if unit_price <= 0:
            continue

        included_rows.append(row)
        pf = _product_fields(row.product)
        result_rows.append(
            {
                "id": row.id,
                "movement_date": row.movement_date,
                **pf,
                "quantity": qty,
                "unit_price": unit_price,
                "line_total": _line_total(unit_price, qty),
                "channel": channel,
                "channel_label": CHANNEL_LABELS.get(channel, channel),
                "sale_channel": row.sale_channel,
                "source_kind": getattr(row, "source_kind", None),
                "avito_order_id": row.avito_order_id,
                "garage_used_order_item_id": getattr(row, "garage_used_order_item_id", None),
                "payment_method": _payment_method_for_row(row),
                "reason": row.reason,
                "storage_location_id": row.storage_location_id,
            }
        )

    count, total = warehouse_sales_totals(included_rows)
    by_channel: dict[str, dict[str, float | int]] = {}
    for ch in (CHANNEL_AVITO, CHANNEL_MARKETPLACE_USED, CHANNEL_WAREHOUSE):
        ch_rows = [
            r
            for r in included_rows
            if resolve_sale_channel(r) == ch
        ]
        ch_count, ch_total = warehouse_sales_totals(ch_rows)
        by_channel[ch] = {"count": ch_count, "total": ch_total, "label": CHANNEL_LABELS[ch]}

    totals = {
        "count": count,
        "total": total,
        "by_channel": by_channel,
    }
    return result_rows, totals


def list_finance_writeoffs(
    db: Session,
    organization_id: str,
    filters: FinanceFilters,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows = (
        db.query(StockOut)
        .options(joinedload(StockOut.product))
        .filter(
            StockOut.organization_id == organization_id,
            *_stock_out_date_filters(filters.date_from, filters.date_to),
        )
        .order_by(StockOut.movement_date.desc(), StockOut.id.desc())
        .all()
    )

    result_rows: list[dict[str, Any]] = []
    total_qty = 0
    for row in rows:
        if is_warehouse_sale(row):
            continue
        qty = int(row.quantity or 0)
        total_qty += qty
        pf = _product_fields(row.product)
        result_rows.append(
            {
                "id": row.id,
                "movement_date": row.movement_date,
                **pf,
                "quantity": qty,
                "sale_price": float(row.sale_price or 0),
                "reason": row.reason,
                "source_kind": getattr(row, "source_kind", None),
                "storage_location_id": row.storage_location_id,
            }
        )

    return result_rows, {"count": len(result_rows), "total_qty": total_qty}


def list_finance_stock_ins(
    db: Session,
    organization_id: str,
    filters: FinanceFilters,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    rows = (
        db.query(StockIn)
        .options(joinedload(StockIn.product))
        .filter(
            StockIn.organization_id == organization_id,
            StockIn.created_at >= filters.date_from,
            StockIn.created_at <= filters.date_to,
        )
        .order_by(StockIn.created_at.desc(), StockIn.id.desc())
        .all()
    )

    result_rows: list[dict[str, Any]] = []
    total_qty = 0
    total_value = 0.0
    for row in rows:
        qty = int(row.quantity or 0)
        try:
            unit = float(row.sale_price or 0)
        except (TypeError, ValueError):
            unit = 0.0
        line_value = unit * qty
        total_qty += qty
        total_value += line_value
        pf = _product_fields(row.product)

        result_rows.append(
            {
                "id": row.id,
                "created_at": row.created_at,
                **pf,
                "quantity": qty,
                "unit_price": unit,
                "line_total": line_value,
                "storage_location_id": row.storage_location_id,
                "creator_name": None,
            }
        )

    return result_rows, {
        "count": len(result_rows),
        "total_qty": total_qty,
        "total_value": total_value,
    }


def list_finance_inventory(
    db: Session,
    organization_id: str,
    filters: FinanceFilters,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    as_of = filters.as_of_date

    in_rows = (
        db.query(
            StockIn.product_id,
            func.coalesce(func.sum(StockIn.quantity), 0).label("in_qty"),
        )
        .filter(
            StockIn.organization_id == organization_id,
            StockIn.created_at <= as_of,
        )
        .group_by(StockIn.product_id)
        .all()
    )
    out_rows = (
        db.query(
            StockOut.product_id,
            func.coalesce(func.sum(StockOut.quantity), 0).label("out_qty"),
        )
        .filter(
            StockOut.organization_id == organization_id,
            StockOut.movement_date <= as_of,
        )
        .group_by(StockOut.product_id)
        .all()
    )

    in_map = {int(r.product_id): int(r.in_qty or 0) for r in in_rows}
    out_map = {int(r.product_id): int(r.out_qty or 0) for r in out_rows}
    product_ids = set(in_map.keys()) | set(out_map.keys())

    if not product_ids:
        return [], {
            "as_of_date": as_of,
            "products_count": 0,
            "total_qty": 0,
            "total_value": 0.0,
        }

    products = (
        db.query(Product)
        .filter(
            Product.organization_id == organization_id,
            Product.id.in_(product_ids),
        )
        .all()
    )
    product_by_id = {p.id: p for p in products}

    result_rows: list[dict[str, Any]] = []
    total_qty = 0
    total_value = 0.0

    for pid in sorted(product_ids):
        in_q = in_map.get(pid, 0)
        out_q = out_map.get(pid, 0)
        qty = in_q - out_q
        if qty == 0:
            continue
        product = product_by_id.get(pid)
        try:
            unit_price = float(product.price or 0) if product else 0.0
        except (TypeError, ValueError):
            unit_price = 0.0
        value = qty * unit_price
        total_qty += qty
        total_value += value
        pf = _product_fields(product)
        result_rows.append(
            {
                **pf,
                "quantity": qty,
                "unit_price": unit_price,
                "line_total": value,
                "stock_in_qty": in_q,
                "stock_out_qty": out_q,
            }
        )

    result_rows.sort(key=lambda r: (r.get("name") or "", r.get("article") or ""))

    return result_rows, {
        "as_of_date": as_of,
        "products_count": len(result_rows),
        "total_qty": total_qty,
        "total_value": total_value,
    }


def build_finance_summary(
    db: Session,
    organization_id: str,
    filters: FinanceFilters,
) -> dict[str, Any]:
    _, sales_totals = list_finance_sales(db, organization_id, filters)
    _, writeoff_totals = list_finance_writeoffs(db, organization_id, filters)
    _, stock_in_totals = list_finance_stock_ins(db, organization_id, filters)
    _, inventory_totals = list_finance_inventory(db, organization_id, filters)

    return {
        "date_from": filters.date_from,
        "date_to": filters.date_to,
        "as_of_date": filters.as_of_date,
        "sales_count": sales_totals["count"],
        "sales_total": sales_totals["total"],
        "sales_by_channel": sales_totals["by_channel"],
        "writeoffs_count": writeoff_totals["count"],
        "writeoffs_qty": writeoff_totals["total_qty"],
        "stock_in_count": stock_in_totals["count"],
        "stock_in_qty": stock_in_totals["total_qty"],
        "stock_in_value": stock_in_totals["total_value"],
        "inventory_products": inventory_totals["products_count"],
        "inventory_qty": inventory_totals["total_qty"],
        "inventory_value": inventory_totals["total_value"],
    }
