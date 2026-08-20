from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
)
from app.services.autoservice_warehouse_service import autoservice_item_available_qty

_TWOPLACES = Decimal("0.01")


def _money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


@dataclass
class WarehouseStockReportFilters:
    year: int
    month: int
    q: str | None = None
    hide_zero: bool = True


def _month_bounds(year: int, month: int) -> tuple[date, date, date]:
    month_start = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    month_end = date(year, month, last_day)
    opening_as_of = month_start.fromordinal(month_start.toordinal() - 1)
    return month_start, month_end, opening_as_of


def _is_current_month(year: int, month: int) -> bool:
    today = date.today()
    return today.year == year and today.month == month


def _aggregate_qty_by_item(
    db: Session,
    org_id: str,
    model,
    *,
    date_to: date | None = None,
    date_from: date | None = None,
) -> dict[int, int]:
    query = (
        db.query(model.item_id, func.coalesce(func.sum(model.quantity), 0))
        .filter(model.organization_id == org_id)
    )
    if date_to is not None:
        query = query.filter(model.created_at <= date_to)
    if date_from is not None:
        query = query.filter(model.created_at >= date_from)
    rows = query.group_by(model.item_id).all()
    return {int(item_id): int(total or 0) for item_id, total in rows}


def _balance(received: int, expensed: int) -> int:
    return max(0, int(received or 0) - int(expensed or 0))


def _matches_search(item: AutoserviceWarehouseItem, term: str) -> bool:
    if not term:
        return True
    needle = term.lower()
    for value in (item.brand, item.article, item.name):
        if value and needle in str(value).lower():
            return True
    return False


def build_warehouse_stock_report(
    db: Session,
    org_id: str,
    filters: WarehouseStockReportFilters,
) -> dict:
    month_start, month_end, opening_as_of = _month_bounds(filters.year, filters.month)
    is_current = _is_current_month(filters.year, filters.month)
    search = (filters.q or "").strip()

    items = (
        db.query(AutoserviceWarehouseItem)
        .filter(AutoserviceWarehouseItem.organization_id == org_id)
        .order_by(
            AutoserviceWarehouseItem.name.asc(),
            AutoserviceWarehouseItem.id.asc(),
        )
        .all()
    )

    receipts_opening = _aggregate_qty_by_item(
        db, org_id, AutoserviceWarehouseReceipt, date_to=opening_as_of,
    )
    expenses_opening = _aggregate_qty_by_item(
        db, org_id, AutoserviceWarehouseExpense, date_to=opening_as_of,
    )
    receipts_closing = _aggregate_qty_by_item(
        db, org_id, AutoserviceWarehouseReceipt, date_to=month_end,
    )
    expenses_closing = _aggregate_qty_by_item(
        db, org_id, AutoserviceWarehouseExpense, date_to=month_end,
    )
    receipts_month = _aggregate_qty_by_item(
        db, org_id, AutoserviceWarehouseReceipt,
        date_from=month_start, date_to=month_end,
    )
    expenses_month = _aggregate_qty_by_item(
        db, org_id, AutoserviceWarehouseExpense,
        date_from=month_start, date_to=month_end,
    )

    rows: list[dict] = []
    summary = {
        "positions": 0,
        "closing_value": Decimal("0.00"),
        "received_qty": 0,
        "expensed_qty": 0,
        "opening_value": Decimal("0.00"),
    }

    for item in items:
        if search and not _matches_search(item, search):
            continue

        opening_qty = _balance(
            receipts_opening.get(item.id, 0),
            expenses_opening.get(item.id, 0),
        )
        closing_qty = _balance(
            receipts_closing.get(item.id, 0),
            expenses_closing.get(item.id, 0),
        )
        received_qty = receipts_month.get(item.id, 0)
        expensed_qty = expenses_month.get(item.id, 0)

        if filters.hide_zero and closing_qty <= 0:
            continue

        unit_price = _money(item.unit_price or 0)
        stock_amount = _money(Decimal(closing_qty) * unit_price)
        reserved_qty = None
        return_reserved_qty = None
        available_qty = None
        if is_current:
            reserved_qty = int(item.reserved_qty or 0)
            return_reserved_qty = int(getattr(item, "return_reserved_qty", 0) or 0)
            available_qty = autoservice_item_available_qty(item)

        rows.append({
            "id": item.id,
            "brand": item.brand or "",
            "article": item.article or "",
            "name": item.name or "",
            "unit": item.unit or "pcs",
            "unit_price": unit_price,
            "opening_qty": opening_qty,
            "received_qty": received_qty,
            "expensed_qty": expensed_qty,
            "closing_qty": closing_qty,
            "reserved_qty": reserved_qty,
            "return_reserved_qty": return_reserved_qty,
            "available_qty": available_qty,
            "stock_amount": stock_amount,
        })

        if closing_qty > 0:
            summary["positions"] += 1
        summary["closing_value"] = _money(summary["closing_value"] + stock_amount)
        summary["opening_value"] = _money(
            summary["opening_value"] + _money(Decimal(opening_qty) * unit_price),
        )
        summary["received_qty"] += received_qty
        summary["expensed_qty"] += expensed_qty

    return {
        "year": filters.year,
        "month": filters.month,
        "as_of": month_end,
        "is_current_month": is_current,
        "summary": summary,
        "items": rows,
    }
