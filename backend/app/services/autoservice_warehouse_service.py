from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
)
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.product import Product
from app.models.repair_order import RepairOrder
from app.schemas.autoservice_warehouse import PurchaseWarehouseImportGroup


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _normalize_brand(value: str | None) -> str:
    return (value or "").strip()[:120]


def _normalize_article(value: str | None) -> str:
    return (value or "").strip()[:120]


def _get_or_create_item(
    db: Session,
    *,
    org_id: str,
    brand: str,
    article: str,
    name: str,
    unit_price: Decimal,
) -> AutoserviceWarehouseItem:
    brand_norm = _normalize_brand(brand)
    article_norm = _normalize_article(article)
    item = (
        db.query(AutoserviceWarehouseItem)
        .filter(
            AutoserviceWarehouseItem.organization_id == org_id,
            AutoserviceWarehouseItem.brand == brand_norm,
            AutoserviceWarehouseItem.article == article_norm,
        )
        .first()
    )
    if item:
        return item
    item = AutoserviceWarehouseItem(
        organization_id=org_id,
        brand=brand_norm,
        article=article_norm,
        name=(name or article_norm or brand_norm or "Запчасть")[:255],
        quantity=0,
        reserved_qty=0,
        unit_price=_money(unit_price),
    )
    db.add(item)
    db.flush()
    return item


def _existing_receipt_for_cart(
    db: Session,
    *,
    org_id: str,
    cart_item_type: str,
    cart_item_id: int,
) -> AutoserviceWarehouseReceipt | None:
    return (
        db.query(AutoserviceWarehouseReceipt)
        .filter(
            AutoserviceWarehouseReceipt.organization_id == org_id,
            AutoserviceWarehouseReceipt.cart_item_type == cart_item_type,
            AutoserviceWarehouseReceipt.cart_item_id == cart_item_id,
        )
        .first()
    )


def receipt_purchase_line(
    db: Session,
    *,
    org_id: str,
    user_id: int,
    cart_item_type: str,
    cart_item_id: int,
    brand: str,
    article: str,
    name: str,
    quantity: int,
    unit_price: Decimal,
    repair_order_id: int | None = None,
) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
    """Create receipt from purchase line. Returns (item, receipt, created)."""
    if quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество должно быть больше 0",
        )

    existing = _existing_receipt_for_cart(
        db,
        org_id=org_id,
        cart_item_type=cart_item_type,
        cart_item_id=cart_item_id,
    )
    if existing:
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(AutoserviceWarehouseItem.id == existing.item_id)
            .first()
        )
        if not item:
            raise HTTPException(status_code=500, detail="Позиция склада не найдена")
        return item, existing, False

    item = _get_or_create_item(
        db,
        org_id=org_id,
        brand=brand,
        article=article,
        name=name,
        unit_price=unit_price,
    )
    item.quantity = int(item.quantity or 0) + quantity
    if _money(unit_price) > 0:
        item.unit_price = _money(unit_price)

    receipt = AutoserviceWarehouseReceipt(
        organization_id=org_id,
        item_id=item.id,
        quantity=quantity,
        unit_price=_money(unit_price),
        cart_item_type=cart_item_type,
        cart_item_id=cart_item_id,
        repair_order_id=repair_order_id,
        created_by=user_id,
    )
    db.add(receipt)
    db.flush()
    return item, receipt, True


def receipt_manual_line(
    db: Session,
    *,
    org_id: str,
    user_id: int,
    brand: str,
    article: str,
    name: str,
    quantity: int,
    unit_price: Decimal,
    repair_order_id: int | None = None,
) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
    """Create a manual warehouse receipt (no purchase cart line)."""
    qty = int(quantity or 0)
    if qty <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество должно быть больше 0",
        )

    name_norm = (name or "").strip()[:255]
    brand_norm = _normalize_brand(brand)
    article_norm = _normalize_article(article) or name_norm[:120]
    if not name_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите наименование запчасти",
        )

    item = _get_or_create_item(
        db,
        org_id=org_id,
        brand=brand_norm,
        article=article_norm,
        name=name_norm,
        unit_price=unit_price,
    )
    item.quantity = int(item.quantity or 0) + qty
    if _money(unit_price) > 0:
        item.unit_price = _money(unit_price)

    receipt = AutoserviceWarehouseReceipt(
        organization_id=org_id,
        item_id=item.id,
        quantity=qty,
        unit_price=_money(unit_price),
        cart_item_type="manual",
        cart_item_id=None,
        repair_order_id=repair_order_id,
        created_by=user_id,
    )
    db.add(receipt)
    db.flush()
    return item, receipt, True


def import_purchase_groups_to_warehouse(
    db: Session,
    *,
    org_id: str,
    user_id: int,
    groups: list[PurchaseWarehouseImportGroup],
) -> tuple[int, int]:
    added = 0
    skipped = 0

    for group in groups:
        if group.order_type == "new":
            rows = (
                db.query(GarageNewOrderItem)
                .join(GarageNewOrder, GarageNewOrderItem.order_id == GarageNewOrder.id)
                .filter(
                    GarageNewOrder.user_id == user_id,
                    GarageNewOrderItem.id.in_(group.item_ids),
                )
                .all()
            )
            for row in rows:
                brand = _normalize_brand(row.brand)
                article = _normalize_article(row.partnumber)
                name = (row.name or "").strip() or article or brand or "Запчасть"
                qty = int(row.quantity or 1)
                price = _money(row.price or 0)
                _, _, created = receipt_purchase_line(
                    db,
                    org_id=org_id,
                    user_id=user_id,
                    cart_item_type="new",
                    cart_item_id=row.id,
                    brand=brand,
                    article=article,
                    name=name,
                    quantity=qty,
                    unit_price=price,
                )
                if created:
                    added += 1
                else:
                    skipped += 1
        else:
            rows = (
                db.query(GarageUsedOrderItem)
                .join(GarageUsedOrder, GarageUsedOrderItem.order_id == GarageUsedOrder.id)
                .options(joinedload(GarageUsedOrderItem.product))
                .filter(
                    GarageUsedOrder.user_id == user_id,
                    GarageUsedOrderItem.id.in_(group.item_ids),
                )
                .all()
            )
            for row in rows:
                product = row.product
                brand = _normalize_brand(row.brand or (product.brand if product else ""))
                article = _normalize_article(
                    row.partnumber
                    or (product.article if product else "")
                    or (product.internal_code if product else "")
                )
                name = (
                    (row.name or "").strip()
                    or (product.name if product else "")
                    or article
                    or brand
                    or "Б/У запчасть"
                )
                qty = int(row.quantity or 1)
                price = _money(row.price or 0)
                _, _, created = receipt_purchase_line(
                    db,
                    org_id=org_id,
                    user_id=user_id,
                    cart_item_type="used",
                    cart_item_id=row.id,
                    brand=brand,
                    article=article,
                    name=name,
                    quantity=qty,
                    unit_price=price,
                )
                if created:
                    added += 1
                else:
                    skipped += 1

    return added, skipped


def consume_reserved_autoservice_stock(
    db: Session,
    *,
    org_id: str,
    user_id: int,
    item: AutoserviceWarehouseItem,
    quantity: int,
    reason: str | None = None,
) -> AutoserviceWarehouseExpense | None:
    """Write off reserved qty into expenses (used when a repair order is completed)."""
    qty = int(quantity or 0)
    if qty <= 0:
        return None
    reserved = int(item.reserved_qty or 0)
    if reserved <= 0:
        return None
    consume = min(qty, reserved, int(item.quantity or 0))
    if consume <= 0:
        return None
    item.reserved_qty = reserved - consume
    item.quantity = int(item.quantity or 0) - consume
    expense = AutoserviceWarehouseExpense(
        organization_id=org_id,
        item_id=item.id,
        quantity=consume,
        unit_price=_money(item.unit_price),
        reason=(reason or "").strip()[:255] or None,
        created_by=user_id,
    )
    db.add(expense)
    db.flush()
    return expense


def fulfill_autoservice_stock_on_order_complete(
    db: Session,
    *,
    order: RepairOrder,
    org_id: str,
    user_id: int,
) -> int:
    """Turn reserved autoservice-stock lines into expenses when the order is completed."""
    created = 0
    order_label = f"Заказ-наряд №{order.order_number}"
    for part in order.shop_parts or []:
        if part.source != "autoservice_stock" or not part.autoservice_stock_item_id:
            continue
        item = (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.id == part.autoservice_stock_item_id,
                AutoserviceWarehouseItem.organization_id == org_id,
            )
            .with_for_update()
            .first()
        )
        if not item:
            continue
        expense = consume_reserved_autoservice_stock(
            db,
            org_id=org_id,
            user_id=user_id,
            item=item,
            quantity=max(1, int(Decimal(str(part.qty or 1)).quantize(Decimal("1")))),
            reason=order_label,
        )
        if expense:
            created += 1
    return created


def create_autoservice_expense(
    db: Session,
    *,
    org_id: str,
    user_id: int,
    item_id: int,
    quantity: int,
    reason: str | None = None,
) -> AutoserviceWarehouseExpense:
    item = (
        db.query(AutoserviceWarehouseItem)
        .filter(
            AutoserviceWarehouseItem.id == item_id,
            AutoserviceWarehouseItem.organization_id == org_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Позиция склада не найдена")

    available = int(item.quantity or 0) - int(item.reserved_qty or 0)
    if quantity > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостаточно доступного товара (доступно {available} шт.)",
        )

    item.quantity = int(item.quantity or 0) - quantity
    expense = AutoserviceWarehouseExpense(
        organization_id=org_id,
        item_id=item.id,
        quantity=quantity,
        unit_price=_money(item.unit_price),
        reason=(reason or "").strip()[:255] or None,
        created_by=user_id,
    )
    db.add(expense)
    db.flush()
    return expense


def product_available_qty(product: Product) -> int:
    return max(0, int(product.quantity or 0) - int(getattr(product, "reserved_qty", 0) or 0))


def autoservice_item_available_qty(item: AutoserviceWarehouseItem) -> int:
    return max(0, int(item.quantity or 0) - int(item.reserved_qty or 0))
