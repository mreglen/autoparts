"""
Единая логика «фактических продаж со склада» для /stock-outs/sales, дашборда и админки.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Iterable

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.avito_orders_cache import AvitoOrderCache
from app.models.product import Product
from app.models.stock_out import StockOut
from app.models.vehicle import Vehicle as VehicleModel
from app.services.avito_order_item_match import find_avito_item_for_product
from app.services.avito_order_pricing import avito_order_items, unit_price_for_stock_out


def is_warehouse_sale(stock_out: StockOut) -> bool:
    """Продажа для отчётов: явная цена, канал Авито или признак в reason."""
    try:
        if float(stock_out.sale_price or 0) > 0:
            return True
    except (TypeError, ValueError):
        pass

    if (stock_out.sale_channel or "").lower() == "avito":
        return True
    if (getattr(stock_out, "source_kind", None) or "").lower() == "avito":
        return True
    if stock_out.avito_order_id:
        return True

    reason = (stock_out.reason or "").lower()
    if "авито" in reason:
        return True
    return False


def _warehouse_sale_filters(organization_id: str):
    return (
        StockOut.organization_id == organization_id,
        or_(
            StockOut.sale_price > 0,
            StockOut.sale_channel == "avito",
            StockOut.source_kind == "avito",
            StockOut.avito_order_id.isnot(None),
            func.coalesce(func.lower(StockOut.reason), "").like("%авито%"),
        ),
    )


def warehouse_sales_query_options():
    return (
        joinedload(StockOut.product).options(
            selectinload(Product.compatible_vehicles).options(
                selectinload(VehicleModel.vin_row),
                selectinload(VehicleModel.mileage_row),
            ),
        ),
        joinedload(StockOut.storage_location),
        joinedload(StockOut.user),
    )


def resolve_effective_unit_price(db: Session, stock_out: StockOut) -> float:
    try:
        current = float(stock_out.sale_price or 0)
    except (TypeError, ValueError):
        current = 0.0
    if current > 0:
        return current

    if stock_out.avito_order_id and stock_out.organization_id:
        order = (
            db.query(AvitoOrderCache)
            .filter(
                AvitoOrderCache.organization_id == stock_out.organization_id,
                AvitoOrderCache.avito_order_id == str(stock_out.avito_order_id),
            )
            .first()
        )
        if order and order.avito_data:
            items = avito_order_items(order.avito_data)
            item = find_avito_item_for_product(
                items,
                db,
                stock_out.organization_id,
                stock_out.product_id,
                product=stock_out.product,
            )
            if item:
                product_price = None
                if stock_out.product is not None:
                    product_price = float(stock_out.product.price or 0)
                else:
                    product = db.query(Product).filter(Product.id == stock_out.product_id).first()
                    if product:
                        product_price = float(product.price or 0)
                unit = unit_price_for_stock_out(item, product_price=product_price)
                if unit > 0:
                    return unit

    if stock_out.product is not None and stock_out.product.price:
        return float(stock_out.product.price)
    product = db.query(Product).filter(Product.id == stock_out.product_id).first()
    if product and product.price:
        return float(product.price)
    return 0.0


def enrich_warehouse_sale_prices(
    db: Session,
    rows: Iterable[StockOut],
    *,
    persist_fixes: bool = False,
) -> list[StockOut]:
    """Подставляет sale_price для ответа API; опционально сохраняет в БД."""
    result = list(rows)
    changed = False
    for row in result:
        if not is_warehouse_sale(row):
            continue
        effective = resolve_effective_unit_price(db, row)
        if effective <= 0:
            continue
        try:
            stored = float(row.sale_price or 0)
        except (TypeError, ValueError):
            stored = 0.0
        if abs(stored - effective) < 0.01:
            continue
        row.sale_price = Decimal(str(round(effective, 2)))
        changed = True

    if persist_fixes and changed:
        db.commit()
    return result


def list_warehouse_sales(
    db: Session,
    organization_id: str,
    *,
    persist_price_fixes: bool = True,
) -> list[StockOut]:
    rows = (
        db.query(StockOut)
        .options(*warehouse_sales_query_options())
        .filter(*_warehouse_sale_filters(organization_id))
        .order_by(StockOut.movement_date.desc())
        .all()
    )
    return enrich_warehouse_sale_prices(db, rows, persist_fixes=persist_price_fixes)


def warehouse_sales_totals(rows: Iterable[StockOut]) -> tuple[int, float]:
    count = 0
    total = 0.0
    for row in rows:
        if not is_warehouse_sale(row):
            continue
        try:
            price = float(row.sale_price or 0)
            qty = int(row.quantity or 0)
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        count += 1
        total += price * qty
    return count, total
