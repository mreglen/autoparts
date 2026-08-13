from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.product import Product
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.schemas.repair_order import RepairOrderPurchaseImportIn
from app.services.repair_order_cart_import import (
    _derive_prices,
    _money,
    _next_position,
    _qty,
)

_TWOPLACES = Decimal("0.01")


def _item_price_override(payload: RepairOrderPurchaseImportIn, item_id: int) -> Decimal | None:
    value = payload.item_price_overrides.get(item_id)
    if value is None:
        return None
    if value < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Итоговая цена не может быть отрицательной",
        )
    return _money(value)


def _existing_purchase_keys(order: RepairOrder) -> set[tuple[str, int]]:
    return {
        (part.cart_item_type, part.cart_item_id)
        for part in (order.shop_parts or [])
        if part.cart_item_type and part.cart_item_id is not None
    }


def _reindex_shop_parts(db: Session, order_id: int) -> None:
    remaining = (
        db.query(RepairOrderShopPart)
        .filter(RepairOrderShopPart.order_id == order_id)
        .order_by(RepairOrderShopPart.position, RepairOrderShopPart.id)
        .all()
    )
    for idx, part in enumerate(remaining, start=1):
        part.position = idx


def detach_purchase_items_from_other_orders(
    db: Session,
    *,
    target_order_id: int,
    org_id: str,
    order_type: str,
    item_ids: list[int],
) -> int:
    """Remove imported purchase lines from other repair orders in the same org."""
    if not item_ids:
        return 0

    stale_parts = (
        db.query(RepairOrderShopPart)
        .join(RepairOrder, RepairOrderShopPart.order_id == RepairOrder.id)
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.id != target_order_id,
            RepairOrderShopPart.cart_item_type == order_type,
            RepairOrderShopPart.cart_item_id.in_(item_ids),
        )
        .all()
    )
    if not stale_parts:
        return 0

    affected_order_ids = {part.order_id for part in stale_parts}
    for part in stale_parts:
        db.delete(part)
    db.flush()
    for order_id in affected_order_ids:
        _reindex_shop_parts(db, order_id)
    return len(stale_parts)


def append_purchase_items_to_repair_order(
    db: Session,
    *,
    order: RepairOrder,
    org_id: str,
    user_id: int,
    payload: RepairOrderPurchaseImportIn,
) -> int:
    """Append completed purchase order lines to repair order shop parts."""
    existing = _existing_purchase_keys(order)
    position = _next_position(order)
    added = 0

    if payload.order_type == "new":
        rows = (
            db.query(GarageNewOrderItem)
            .join(GarageNewOrder, GarageNewOrderItem.order_id == GarageNewOrder.id)
            .filter(
                GarageNewOrder.user_id == user_id,
                GarageNewOrderItem.id.in_(payload.item_ids),
            )
            .all()
        )
        found_ids = {row.id for row in rows}
        missing = set(payload.item_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоторые позиции заказа не найдены или недоступны",
            )

        detach_purchase_items_from_other_orders(
            db,
            target_order_id=order.id,
            org_id=org_id,
            order_type="new",
            item_ids=payload.item_ids,
        )

        for row in rows:
            key = ("new", row.id)
            if key in existing:
                continue

            brand = (row.brand or "").strip()
            partnumber = (row.partnumber or "").strip()
            title = (row.name or "").strip() or partnumber or brand or "Запчасть"
            unit_price, _ = _derive_prices(row.price, None)
            markup_percent = _money(payload.markup_percent)

            order.shop_parts.append(
                RepairOrderShopPart(
                    position=position,
                    title=title[:255],
                    brand=brand[:120] or None,
                    partnumber=partnumber[:120] or None,
                    qty=_qty(row.quantity or 1),
                    unit="pcs",
                    unit_price=unit_price,
                    markup_percent=markup_percent,
                    client_unit_price_override=_item_price_override(payload, row.id),
                    source="rossko",
                    product_id=None,
                    rossko_brand=brand[:120] or None,
                    rossko_partnumber=partnumber[:120] or None,
                    cart_item_type="new",
                    cart_item_id=row.id,
                )
            )
            existing.add(key)
            position += 1
            added += 1
    else:
        rows = (
            db.query(GarageUsedOrderItem)
            .join(GarageUsedOrder, GarageUsedOrderItem.order_id == GarageUsedOrder.id)
            .options(joinedload(GarageUsedOrderItem.product).joinedload(Product.organization))
            .filter(
                GarageUsedOrder.user_id == user_id,
                GarageUsedOrderItem.id.in_(payload.item_ids),
            )
            .all()
        )
        found_ids = {row.id for row in rows}
        missing = set(payload.item_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Некоторые позиции заказа не найдены или недоступны",
            )

        detach_purchase_items_from_other_orders(
            db,
            target_order_id=order.id,
            org_id=org_id,
            order_type="used",
            item_ids=payload.item_ids,
        )

        for row in rows:
            key = ("used", row.id)
            if key in existing:
                continue

            product = row.product
            brand = (row.brand or (product.brand if product else "") or "").strip()
            partnumber = (
                row.partnumber
                or (product.article if product else "")
                or (product.internal_code if product else "")
                or ""
            ).strip()
            title = (
                (row.name or "").strip()
                or (product.name if product else "")
                or partnumber
                or brand
                or "Б/У запчасть"
            ).strip()

            if product and product.organization_id == org_id:
                source = "warehouse"
                product_id = product.id
            else:
                source = "manual"
                product_id = None

            unit_price, _ = _derive_prices(row.price or 0, None)
            markup_percent = _money(payload.markup_percent)

            order.shop_parts.append(
                RepairOrderShopPart(
                    position=position,
                    title=title[:255],
                    brand=brand[:120] or None,
                    partnumber=partnumber[:120] or None,
                    qty=_qty(row.quantity or 1),
                    unit="pcs",
                    unit_price=unit_price,
                    markup_percent=markup_percent,
                    client_unit_price_override=_item_price_override(payload, row.id),
                    source=source,
                    product_id=product_id,
                    rossko_brand=None,
                    rossko_partnumber=None,
                    cart_item_type="used",
                    cart_item_id=row.id,
                )
            )
            existing.add(key)
            position += 1
            added += 1

    return added


def shop_part_is_imported(part: RepairOrderShopPart) -> bool:
    return bool(part.cart_item_type and part.cart_item_id is not None)


def lookup_purchase_item_repair_orders(
    db: Session,
    *,
    org_id: str | None,
    order_type: str,
    item_ids: list[int],
) -> dict[int, dict[str, int | str | None]]:
    """Map purchase item id -> {id, order_number} of the linked repair order."""
    if not org_id or not item_ids:
        return {}
    rows = (
        db.query(
            RepairOrderShopPart.cart_item_id,
            RepairOrder.id,
            RepairOrder.order_number,
        )
        .join(RepairOrder, RepairOrderShopPart.order_id == RepairOrder.id)
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrderShopPart.cart_item_type == order_type,
            RepairOrderShopPart.cart_item_id.in_(item_ids),
        )
        .all()
    )
    return {
        int(item_id): {"id": int(order_id), "order_number": order_number}
        for item_id, order_id, order_number in rows
        if item_id is not None
    }


def apply_purchase_item_repair_order_links(items, links: dict[int, dict]) -> None:
    for item in items or []:
        link = links.get(getattr(item, "id", None)) or {}
        item.repair_order_id = link.get("id")
        item.repair_order_number = link.get("order_number")
