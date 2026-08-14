from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.autoservice_warehouse import AutoserviceWarehouseItem
from app.models.product import Product
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.services.autoservice_warehouse_service import autoservice_item_available_qty, product_available_qty


def _qty_int(value) -> int:
    return max(1, int(Decimal(str(value or 1)).quantize(Decimal("1"))))


def release_shop_part_reservation(db: Session, part: RepairOrderShopPart) -> None:
    qty = _qty_int(part.qty)
    if part.source == "warehouse" and part.product_id:
        product = db.query(Product).filter(Product.id == part.product_id).first()
        if product:
            product.reserved_qty = max(0, int(product.reserved_qty or 0) - qty)
    elif part.source == "autoservice_stock" and part.autoservice_stock_item_id:
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(AutoserviceWarehouseItem.id == part.autoservice_stock_item_id)
            .first()
        )
        if item:
            item.reserved_qty = max(0, int(item.reserved_qty or 0) - qty)


def apply_shop_part_reservation(db: Session, part: RepairOrderShopPart) -> None:
    qty = _qty_int(part.qty)
    if part.source == "warehouse" and part.product_id:
        product = (
            db.query(Product)
            .filter(Product.id == part.product_id)
            .with_for_update()
            .first()
        )
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Товар склада не найден",
            )
        available = product_available_qty(product)
        if qty > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостаточно доступного товара «{product.name or product.article}» "
                f"(доступно {available} шт.)",
            )
        product.reserved_qty = int(product.reserved_qty or 0) + qty
    elif part.source == "autoservice_stock" and part.autoservice_stock_item_id:
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(AutoserviceWarehouseItem.id == part.autoservice_stock_item_id)
            .with_for_update()
            .first()
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Позиция склада автосервиса не найдена",
            )
        available = autoservice_item_available_qty(item)
        if qty > available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостаточно доступного товара «{item.name}» (доступно {available} шт.)",
            )
        item.reserved_qty = int(item.reserved_qty or 0) + qty


def release_order_reservations(db: Session, order: RepairOrder) -> None:
    for part in order.shop_parts or []:
        if part.source in ("warehouse", "autoservice_stock"):
            release_shop_part_reservation(db, part)


def sync_order_reservations(
    db: Session,
    order: RepairOrder,
    previous_parts: list[RepairOrderShopPart] | None = None,
) -> None:
    """Release old reservations and apply new ones for warehouse-linked shop parts."""
    if previous_parts:
        for part in previous_parts:
            if part.source in ("warehouse", "autoservice_stock"):
                release_shop_part_reservation(db, part)
    for part in order.shop_parts or []:
        if part.source in ("warehouse", "autoservice_stock"):
            apply_shop_part_reservation(db, part)


def shop_part_stock_max_qty(
    db: Session,
    org_id: str,
    part: RepairOrderShopPart,
) -> int | None:
    """Max editable qty: currently available plus qty already reserved on this line."""
    line_qty = _qty_int(part.qty)
    if part.source == "warehouse" and part.product_id:
        product = (
            db.query(Product)
            .filter(Product.id == part.product_id, Product.organization_id == org_id)
            .first()
        )
        if not product:
            return None
        return product_available_qty(product) + line_qty
    if part.source == "autoservice_stock" and part.autoservice_stock_item_id:
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.id == part.autoservice_stock_item_id,
                AutoserviceWarehouseItem.organization_id == org_id,
            )
            .first()
        )
        if not item:
            return None
        return autoservice_item_available_qty(item) + line_qty
    return None


def reserve_autoservice_item_for_repair(
    db: Session,
    *,
    item: AutoserviceWarehouseItem,
    qty: int,
) -> None:
    available = autoservice_item_available_qty(item)
    if qty > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостаточно доступного товара «{item.name}» (доступно {available} шт.)",
        )
    item.reserved_qty = int(item.reserved_qty or 0) + qty


def append_autoservice_stock_to_repair_order(
    db: Session,
    *,
    order: RepairOrder,
    org_id: str,
    items: list[tuple[int, int]],
    markup_percent: Decimal | int | float = 0,
) -> int:
    """Append autoservice warehouse items to a repair order and reserve them."""
    from app.services.repair_order_cart_import import _money, _next_position, _qty

    added = 0
    position = _next_position(order)
    markup = _money(markup_percent)
    for item_id, qty in items:
        if qty <= 0:
            continue
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.id == item_id,
                AutoserviceWarehouseItem.organization_id == org_id,
            )
            .with_for_update()
            .first()
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Позиция склада автосервиса не найдена",
            )
        reserve_autoservice_item_for_repair(db, item=item, qty=qty)
        title = (item.name or item.article or item.brand or "Запчасть")[:255]
        order.shop_parts.append(
            RepairOrderShopPart(
                position=position,
                title=title,
                brand=(item.brand or "")[:120] or None,
                partnumber=(item.article or "")[:120] or None,
                qty=_qty(qty),
                unit="pcs",
                unit_price=_money(item.unit_price),
                markup_percent=markup,
                source="autoservice_stock",
                product_id=None,
                autoservice_stock_item_id=item.id,
            )
        )
        position += 1
        added += 1
    return added
