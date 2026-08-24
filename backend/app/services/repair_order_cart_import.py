from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.carts.new_parts_cart import NewPartsCart
from app.models.carts.used_parts_cart import UsedPartsCart
from app.models.product import Product
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.models.user import User
from app.schemas.repair_order import RepairOrderCartImportIn

_TWOPLACES = Decimal("0.01")
_THREEPLACES = Decimal("0.001")

CART_ITEM_TYPE_NEW = "cart_new"
CART_ITEM_TYPE_USED = "cart_used"


def _money(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_TWOPLACES, rounding=ROUND_HALF_UP)


def _qty(value: Decimal | int | float | str) -> Decimal:
    return Decimal(str(value)).quantize(_THREEPLACES, rounding=ROUND_HALF_UP)


def shop_part_display_name(
    *,
    title: str,
    brand: str | None = None,
    partnumber: str | None = None,
    rossko_brand: str | None = None,
    rossko_partnumber: str | None = None,
) -> str:
    chunks: list[str] = []
    for val in (
        (brand or rossko_brand or "").strip(),
        (partnumber or rossko_partnumber or "").strip(),
        (title or "").strip(),
    ):
        if val and (not chunks or val != chunks[-1]):
            chunks.append(val)
    return " ".join(chunks)[:255] or (title or "").strip()[:255]


def _derive_prices(client_price: Decimal, purchase_price: Decimal | None) -> tuple[Decimal, Decimal]:
    purchase = _money(purchase_price) if purchase_price is not None else Decimal("0.00")
    client = _money(client_price)
    if purchase > 0:
        markup = _money((client / purchase - Decimal("1")) * Decimal("100"))
        return purchase, markup
    return client, Decimal("0.00")


def _next_position(order: RepairOrder) -> int:
    if not order.shop_parts:
        return 1
    return max(part.position for part in order.shop_parts) + 1


def _existing_cart_keys(order: RepairOrder) -> set[tuple[str, int]]:
    return {
        (part.cart_item_type, part.cart_item_id)
        for part in (order.shop_parts or [])
        if part.cart_item_type in (CART_ITEM_TYPE_NEW, CART_ITEM_TYPE_USED)
        and part.cart_item_id is not None
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


def detach_cart_items_from_other_orders(
    db: Session,
    *,
    target_order_id: int,
    org_id: str,
    cart_item_type: str,
    item_ids: list[int],
) -> int:
    if not item_ids:
        return 0

    stale_parts = (
        db.query(RepairOrderShopPart)
        .join(RepairOrder, RepairOrderShopPart.order_id == RepairOrder.id)
        .filter(
            RepairOrder.organization_id == org_id,
            RepairOrder.id != target_order_id,
            RepairOrderShopPart.cart_item_type == cart_item_type,
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


def shop_part_is_in_cart(db: Session, part: RepairOrderShopPart) -> bool:
    if part.cart_item_type not in (CART_ITEM_TYPE_NEW, CART_ITEM_TYPE_USED):
        return False
    if part.cart_item_id is None:
        return False
    if part.cart_item_type == CART_ITEM_TYPE_NEW:
        return (
            db.query(NewPartsCart.id)
            .filter(NewPartsCart.id == part.cart_item_id)
            .first()
            is not None
        )
    return (
        db.query(UsedPartsCart.id)
        .filter(UsedPartsCart.id == part.cart_item_id)
        .first()
        is not None
    )


def clear_repair_order_cart_links(
    db: Session,
    *,
    cart_item_type: str,
    cart_item_ids: list[int],
) -> int:
    if not cart_item_ids:
        return 0
    parts = (
        db.query(RepairOrderShopPart)
        .filter(
            RepairOrderShopPart.cart_item_type == cart_item_type,
            RepairOrderShopPart.cart_item_id.in_(cart_item_ids),
        )
        .all()
    )
    for part in parts:
        part.cart_item_type = None
        part.cart_item_id = None
    db.flush()
    return len(parts)


def append_cart_items_to_repair_order(
    db: Session,
    *,
    order: RepairOrder,
    org_id: str,
    user: User,
    payload: RepairOrderCartImportIn,
) -> int:
    """Append live cart rows to repair order shop parts without warehouse reservation."""
    from app.schemas.repair_order import HISTORY_STATUSES

    if order.status in HISTORY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя добавлять запчасти в завершённый или отменённый заказ-наряд",
        )

    existing = _existing_cart_keys(order)
    position = _next_position(order)
    added = 0
    markup_percent = _money(payload.markup_percent)

    new_ids = [item.item_id for item in payload.items if item.item_type == "new"]
    used_ids = [item.item_id for item in payload.items if item.item_type == "used"]

    if new_ids:
        detach_cart_items_from_other_orders(
            db,
            target_order_id=order.id,
            org_id=org_id,
            cart_item_type=CART_ITEM_TYPE_NEW,
            item_ids=new_ids,
        )
    if used_ids:
        detach_cart_items_from_other_orders(
            db,
            target_order_id=order.id,
            org_id=org_id,
            cart_item_type=CART_ITEM_TYPE_USED,
            item_ids=used_ids,
        )

    new_rows = (
        db.query(NewPartsCart)
        .filter(
            NewPartsCart.user_id == user.id,
            NewPartsCart.id.in_(new_ids),
        )
        .all()
        if new_ids
        else []
    )
    new_found = {row.id for row in new_rows}
    new_missing = set(new_ids) - new_found
    if new_missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некоторые позиции корзины не найдены или недоступны",
        )

    used_rows = (
        db.query(UsedPartsCart)
        .filter(
            UsedPartsCart.user_id == user.id,
            UsedPartsCart.id.in_(used_ids),
        )
        .all()
        if used_ids
        else []
    )
    used_found = {row.id for row in used_rows}
    used_missing = set(used_ids) - used_found
    if used_missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некоторые позиции корзины не найдены или недоступны",
        )

    new_by_id = {row.id: row for row in new_rows}
    used_by_id = {row.id: row for row in used_rows}

    for entry in payload.items:
        if entry.item_type == "new":
            row = new_by_id.get(entry.item_id)
            if not row:
                continue
            key = (CART_ITEM_TYPE_NEW, row.id)
            if key in existing:
                continue

            brand = (row.brand or "").strip()
            partnumber = (row.partnumber or "").strip()
            title = (row.name or "").strip() or partnumber or brand or "Запчасть"
            purchase = row.purchase_price if row.purchase_price is not None else None
            checkout_price = row.price
            unit_price, derived_markup = _derive_prices(checkout_price, purchase)
            effective_markup = markup_percent if markup_percent > 0 else derived_markup
            qty = _qty(row.quantity or 1)

            order.shop_parts.append(
                RepairOrderShopPart(
                    position=position,
                    title=title[:255],
                    brand=brand[:120] or None,
                    partnumber=partnumber[:120] or None,
                    qty=qty,
                    unit="pcs",
                    unit_price=unit_price,
                    markup_percent=effective_markup,
                    source="rossko",
                    rossko_brand=brand[:120] or None,
                    rossko_partnumber=partnumber[:120] or None,
                    cart_item_type=CART_ITEM_TYPE_NEW,
                    cart_item_id=row.id,
                )
            )
            existing.add(key)
            position += 1
            added += 1
            continue

        row = used_by_id.get(entry.item_id)
        if not row:
            continue
        key = (CART_ITEM_TYPE_USED, row.id)
        if key in existing:
            continue

        product = (
            db.query(Product).filter(Product.id == row.product_id).first()
            if row.product_id
            else None
        )
        brand = (row.brand or (product.brand if product else "") or "").strip()
        partnumber = (
            row.partnumber
            or (product.article if product else "")
            or (product.internal_code if product else "")
            or ""
        ).strip()
        title = (
            (product.name if product else "")
            or partnumber
            or brand
            or "Б/У запчасть"
        ).strip()
        unit_price = _money(row.price or (product.price if product else 0))
        qty = _qty(row.quantity or 1)

        order.shop_parts.append(
            RepairOrderShopPart(
                position=position,
                title=title[:255],
                brand=brand[:120] or None,
                partnumber=partnumber[:120] or None,
                qty=qty,
                unit="pcs",
                unit_price=unit_price,
                markup_percent=markup_percent,
                source="manual",
                product_id=row.product_id,
                cart_item_type=CART_ITEM_TYPE_USED,
                cart_item_id=row.id,
            )
        )
        existing.add(key)
        position += 1
        added += 1

    return added
