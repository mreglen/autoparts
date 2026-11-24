from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
)
from app.models.product import Product
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.models.user import User
from app.schemas.repair_order import HISTORY_STATUSES
from app.services.autoservice_warehouse_return_service import (
    _provider_meta,
    create_warehouse_return,
)
from app.services.autoservice_warehouse_service import _effective_client_price, _money
from app.services.repair_order_purchase_import import _reindex_shop_parts
from app.services.repair_order_stock_reserve import (
    _qty_int,
    _release_reserved_qty,
    release_shop_part_reservation,
)

RETURN_REASONS = {"defect", "wrong_item", "not_as_described", "changed_mind", "other"}


def _release_reservation_qty(db: Session, part: RepairOrderShopPart, qty_int: int) -> None:
    if qty_int <= 0:
        return
    if part.source == "warehouse" and part.product_id:
        product = (
            db.query(Product).filter(Product.id == part.product_id).first()
        )
        if product:
            _release_reserved_qty(product, qty=qty_int, part=part)
    elif part.source == "autoservice_stock" and part.autoservice_stock_item_id:
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(AutoserviceWarehouseItem.id == part.autoservice_stock_item_id)
            .first()
        )
        if item:
            _release_reserved_qty(item, qty=qty_int, part=part)


def _part_receipt(db: Session, org_id: str, part: RepairOrderShopPart):
    if not part.warehouse_receipt_id:
        return None
    return (
        db.query(AutoserviceWarehouseReceipt)
        .filter(
            AutoserviceWarehouseReceipt.id == part.warehouse_receipt_id,
            AutoserviceWarehouseReceipt.organization_id == org_id,
        )
        .first()
    )


def shop_part_return_kind(db: Session, org_id: str, part: RepairOrderShopPart) -> str:
    """'rossko' — оформляется заявка на возврат поставщику; 'standard' — списание с пометкой."""
    if part.source != "autoservice_stock":
        return "standard"
    receipt = _part_receipt(db, org_id, part)
    if not receipt:
        return "standard"
    doc = receipt.document
    source_type = (doc.source_order_type if doc else None) or receipt.cart_item_type
    source_order_id = doc.source_order_id if doc else None
    if source_type not in ("new", "used") or source_order_id is None:
        return "standard"
    provider_kind, _supplier_org_id, _mode = _provider_meta(
        db,
        source_order_type=source_type,
        source_order_id=int(source_order_id),
        supplier_name=(doc.supplier_name if doc else None) or "Поставщик",
    )
    return "rossko" if provider_kind == "rossko" else "standard"


def return_repair_order_shop_part(
    db: Session,
    *,
    org_id: str,
    order_id: int,
    part_id: int,
    quantity: int,
    user: User,
    reason: str | None = None,
    comment: str | None = None,
    photo_urls: list[str] | None = None,
) -> RepairOrder:
    order = (
        db.query(RepairOrder)
        .filter(
            RepairOrder.id == order_id,
            RepairOrder.organization_id == org_id,
        )
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ-наряд не найден")
    if order.status in HISTORY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя изменять завершённый или отменённый заказ-наряд",
        )

    part = (
        db.query(RepairOrderShopPart)
        .filter(
            RepairOrderShopPart.id == part_id,
            RepairOrderShopPart.order_id == order_id,
        )
        .first()
    )
    if not part:
        raise HTTPException(status_code=404, detail="Позиция заказ-наряда не найдена")
    if getattr(part, "autoservice_stock_consumed", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Позиция уже списана со склада — скорректируйте заказ иначе",
        )

    part_qty = Decimal(str(part.qty or 0))
    qty_dec = min(Decimal(str(quantity)), part_qty)
    if qty_dec <= 0:
        raise HTTPException(status_code=400, detail="Некорректное количество возврата")
    full = qty_dec >= part_qty
    rel_qty = _qty_int(qty_dec) if not full else _qty_int(part_qty)

    if full:
        release_shop_part_reservation(db, part)
    else:
        _release_reservation_qty(db, part, rel_qty)

    receipt = _part_receipt(db, org_id, part)
    is_rossko = False
    if receipt:
        doc = receipt.document
        source_type = (doc.source_order_type if doc else None) or receipt.cart_item_type
        source_order_id = doc.source_order_id if doc else None
        if source_type in ("new", "used") and source_order_id is not None:
            provider_kind, _s, _m = _provider_meta(
                db,
                source_order_type=source_type,
                source_order_id=int(source_order_id),
                supplier_name=(doc.supplier_name if doc else None) or "Поставщик",
            )
            is_rossko = provider_kind == "rossko"

    order_label = f"Заказ-наряд №{order.order_number}"

    part.qty = part_qty - qty_dec
    if part.qty <= 0:
        db.delete(part)
    db.flush()
    _reindex_shop_parts(db, order_id)

    if is_rossko and receipt:
        reason_code = (reason or "other").strip()
        if reason_code not in RETURN_REASONS:
            raise HTTPException(status_code=400, detail="Некорректная причина возврата")
        # Коммит внутри create_warehouse_return зафиксирует и правки позиции.
        create_warehouse_return(
            db,
            org_id=org_id,
            user=user,
            receipt_id=receipt.id,
            quantity=rel_qty,
            reason=reason_code,
            comment=comment,
            photo_urls=photo_urls or [],
            skip_reserved_check=True,
        )
    elif part.autoservice_stock_item_id:
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.id == part.autoservice_stock_item_id,
                AutoserviceWarehouseItem.organization_id == org_id,
            )
            .with_for_update()
            .first()
        )
        if item:
            consume = min(rel_qty, int(item.quantity or 0))
            if consume > 0:
                item.quantity = int(item.quantity or 0) - consume
                db.add(
                    AutoserviceWarehouseExpense(
                        organization_id=org_id,
                        item_id=item.id,
                        quantity=consume,
                        unit_price=_money(item.unit_price),
                        client_unit_price=_effective_client_price(part),
                        reason=f"Возврат · {order_label}",
                        created_by=user.id,
                    )
                )

    return order
