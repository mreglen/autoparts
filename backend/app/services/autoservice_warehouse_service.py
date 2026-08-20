from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
    AutoserviceWarehouseReceiptDoc,
)
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.organization import Organization
from app.models.product import Product
from app.models.repair_order import RepairOrder, RepairOrderShopPart
from app.models.user import User
from app.schemas.autoservice_warehouse import PurchaseWarehouseImportGroup
from app.utils.purchase_buyer_access import fetch_used_purchase_items_for_buyer
from app.utils.autoservice_warehouse_supplier import (
    ROSSKO_SUPPLIER_LABEL,
    is_admin_marketplace_rossko_new_order,
    resolve_autoservice_supplier_display_name,
)

SupplierKind = Literal["manual", "my_parts", "purchase_new", "purchase_used"]


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _normalize_brand(value: str | None) -> str:
    return (value or "").strip()[:120]


def _normalize_article(value: str | None) -> str:
    return (value or "").strip()[:120]


def _warehouse_item_identity_conflict_message(*, brand: str, article: str) -> str:
    return "На складе уже есть товар с таким брендом и артикулом"


def _ensure_unique_warehouse_item_identity(
    db: Session,
    *,
    org_id: str,
    item_id: int,
    brand: str,
    article: str,
) -> None:
    if not brand and not article:
        return
    conflict = (
        db.query(AutoserviceWarehouseItem)
        .filter(
            AutoserviceWarehouseItem.organization_id == org_id,
            AutoserviceWarehouseItem.brand == brand,
            AutoserviceWarehouseItem.article == article,
            AutoserviceWarehouseItem.id != item_id,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_warehouse_item_identity_conflict_message(
                brand=brand,
                article=article,
            ),
        )


def _create_item(
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
    if not brand_norm and not article_norm:
        return _create_item(
            db,
            org_id=org_id,
            brand=brand_norm,
            article=article_norm,
            name=name,
            unit_price=unit_price,
        )
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
    return _create_item(
        db,
        org_id=org_id,
        brand=brand_norm,
        article=article_norm,
        name=name,
        unit_price=unit_price,
    )


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


def _next_receipt_doc_number(db: Session, org_id: str) -> str:
    rows = (
        db.query(AutoserviceWarehouseReceiptDoc.number)
        .filter(AutoserviceWarehouseReceiptDoc.organization_id == org_id)
        .all()
    )
    max_seq = 0
    for (num,) in rows:
        raw = str(num or "").strip()
        if raw.isdigit():
            max_seq = max(max_seq, int(raw))
            continue
        if raw.startswith("ПН-"):
            suffix = raw[3:].lstrip("0") or "0"
            if suffix.isdigit():
                max_seq = max(max_seq, int(suffix))
    return str(max_seq + 1)


def _organization_name(db: Session, org_id: str | None) -> str:
    if not org_id:
        return "Поставщик"
    org = db.query(Organization).filter(Organization.id == org_id).first()
    return (org.name if org and org.name else org_id) or "Поставщик"


def _purchase_supplier_meta(
    db: Session,
    *,
    order_type: str,
    source_order_id: int,
) -> tuple[SupplierKind, str]:
    if order_type == "new":
        order = db.query(GarageNewOrder).filter(GarageNewOrder.id == source_order_id).first()
        if not order:
            return "purchase_new", "Поставщик"
        if is_admin_marketplace_rossko_new_order(
            db,
            source_order_type="new",
            source_order_id=source_order_id,
        ):
            return "purchase_new", ROSSKO_SUPPLIER_LABEL
        seller = (order.seller or "").strip()
        if seller:
            return "purchase_new", seller[:255]
        return "purchase_new", _organization_name(db, order.organization_id)
    order = db.query(GarageUsedOrder).filter(GarageUsedOrder.id == source_order_id).first()
    if not order:
        return "purchase_used", "Поставщик"
    return "purchase_used", _organization_name(db, order.organization_id)


def _purchase_order_id_for_cart_item(
    db: Session,
    *,
    order_type: str,
    cart_item_id: int,
) -> int | None:
    if order_type == "new":
        row = db.query(GarageNewOrderItem.order_id).filter(GarageNewOrderItem.id == cart_item_id).first()
        return int(row[0]) if row else None
    row = db.query(GarageUsedOrderItem.order_id).filter(GarageUsedOrderItem.id == cart_item_id).first()
    return int(row[0]) if row else None


def repair_order_receipt_doc_date(order) -> date:
    shipped = getattr(order, "shipping_date", None)
    if shipped:
        return shipped
    return date.today()


@dataclass
class _PendingReceiptLine:
    receipt: AutoserviceWarehouseReceipt
    supplier_kind: SupplierKind
    supplier_name: str
    source_order_type: str | None
    source_order_id: int | None
    doc_date: date


class ReceiptDocumentBatch:
    """Accumulates receipt lines and creates grouped receipt documents on flush."""

    def __init__(
        self,
        db: Session,
        *,
        org_id: str,
        user_id: int,
        repair_order_id: int | None = None,
        receipt_doc_date: date | None = None,
    ) -> None:
        self.db = db
        self.org_id = org_id
        self.user_id = user_id
        self.repair_order_id = repair_order_id
        self.receipt_doc_date = receipt_doc_date
        self._pending: list[_PendingReceiptLine] = []

    def _append_receipt(
        self,
        *,
        item: AutoserviceWarehouseItem,
        quantity: int,
        unit_price: Decimal,
        cart_item_type: str | None,
        cart_item_id: int | None,
        supplier_kind: SupplierKind,
        supplier_name: str,
        source_order_type: str | None,
        source_order_id: int | None,
        doc_date: date | None = None,
    ) -> AutoserviceWarehouseReceipt:
        effective_doc_date = doc_date or self.receipt_doc_date or date.today()
        receipt = AutoserviceWarehouseReceipt(
            organization_id=self.org_id,
            item_id=item.id,
            quantity=quantity,
            unit_price=_money(unit_price),
            cart_item_type=cart_item_type,
            cart_item_id=cart_item_id,
            repair_order_id=self.repair_order_id,
            created_by=self.user_id,
            created_at=effective_doc_date,
        )
        self.db.add(receipt)
        self.db.flush()
        self._pending.append(
            _PendingReceiptLine(
                receipt=receipt,
                supplier_kind=supplier_kind,
                supplier_name=supplier_name,
                source_order_type=source_order_type,
                source_order_id=source_order_id,
                doc_date=effective_doc_date,
            )
        )
        return receipt

    def add_manual(
        self,
        *,
        brand: str,
        article: str,
        name: str,
        quantity: int,
        unit_price: Decimal,
        unit: str = "pcs",
        doc_date: date | None = None,
    ) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
        qty = int(quantity or 0)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Количество должно быть больше 0",
            )
        name_norm = (name or "").strip()[:255]
        if not name_norm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите наименование запчасти",
            )
        item = _get_or_create_item(
            self.db,
            org_id=self.org_id,
            brand=brand,
            article=article,
            name=name_norm,
            unit_price=unit_price,
        )
        item.quantity = int(item.quantity or 0) + qty
        if _money(unit_price) > 0:
            item.unit_price = _money(unit_price)
        if unit in ("pcs", "l", "kg"):
            item.unit = unit
        receipt = self._append_receipt(
            item=item,
            quantity=qty,
            unit_price=unit_price,
            cart_item_type="manual",
            cart_item_id=None,
            supplier_kind="manual",
            supplier_name="Вручную",
            source_order_type=None,
            source_order_id=None,
            doc_date=doc_date,
        )
        return item, receipt, True

    def add_my_parts(
        self,
        *,
        product: Product,
        brand: str,
        article: str,
        name: str,
        quantity: int,
        unit_price: Decimal,
        doc_date: date | None = None,
    ) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
        qty = int(quantity or 0)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Количество должно быть больше 0",
            )
        on_hand = int(product.quantity or 0)
        if qty > on_hand:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Недостаточно товара «{product.name or product.article}» (доступно {on_hand} шт.)",
            )
        product.quantity = on_hand - qty
        product.reserved_qty = max(0, int(product.reserved_qty or 0) - qty)

        item = _get_or_create_item(
            self.db,
            org_id=self.org_id,
            brand=brand,
            article=article,
            name=name,
            unit_price=unit_price,
        )
        item.quantity = int(item.quantity or 0) + qty
        if _money(unit_price) > 0:
            item.unit_price = _money(unit_price)
        receipt = self._append_receipt(
            item=item,
            quantity=qty,
            unit_price=unit_price,
            cart_item_type="my_parts",
            cart_item_id=product.id,
            supplier_kind="my_parts",
            supplier_name="Мои запчасти",
            source_order_type=None,
            source_order_id=None,
            doc_date=doc_date,
        )
        return item, receipt, True

    def add_my_parts_restored(
        self,
        *,
        product_id: int | None,
        brand: str,
        article: str,
        name: str,
        quantity: int,
        unit_price: Decimal,
        doc_date: date | None = None,
    ) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
        """Restore a my_parts receipt line without deducting Product (backfill only)."""
        qty = int(quantity or 0)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Количество должно быть больше 0",
            )
        item = _get_or_create_item(
            self.db,
            org_id=self.org_id,
            brand=brand,
            article=article,
            name=name,
            unit_price=unit_price,
        )
        item.quantity = int(item.quantity or 0) + qty
        if _money(unit_price) > 0:
            item.unit_price = _money(unit_price)
        receipt = self._append_receipt(
            item=item,
            quantity=qty,
            unit_price=unit_price,
            cart_item_type="my_parts",
            cart_item_id=product_id,
            supplier_kind="my_parts",
            supplier_name="Мои запчасти",
            source_order_type=None,
            source_order_id=None,
            doc_date=doc_date,
        )
        return item, receipt, True

    def add_purchase(
        self,
        *,
        cart_item_type: str,
        cart_item_id: int,
        brand: str,
        article: str,
        name: str,
        quantity: int,
        unit_price: Decimal,
        source_order_type: str,
        source_order_id: int,
        doc_date: date | None = None,
    ) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
        qty = int(quantity or 0)
        if qty <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Количество должно быть больше 0",
            )

        existing = _existing_receipt_for_cart(
            self.db,
            org_id=self.org_id,
            cart_item_type=cart_item_type,
            cart_item_id=cart_item_id,
        )
        if existing:
            item = (
                self.db.query(AutoserviceWarehouseItem)
                .filter(AutoserviceWarehouseItem.id == existing.item_id)
                .first()
            )
            if not item:
                raise HTTPException(status_code=500, detail="Позиция склада не найдена")
            return item, existing, False

        supplier_kind, supplier_name = _purchase_supplier_meta(
            self.db,
            order_type=source_order_type,
            source_order_id=source_order_id,
        )
        item = _get_or_create_item(
            self.db,
            org_id=self.org_id,
            brand=brand,
            article=article,
            name=name,
            unit_price=unit_price,
        )
        item.quantity = int(item.quantity or 0) + qty
        if _money(unit_price) > 0:
            item.unit_price = _money(unit_price)
        receipt = self._append_receipt(
            item=item,
            quantity=qty,
            unit_price=unit_price,
            cart_item_type=cart_item_type,
            cart_item_id=cart_item_id,
            supplier_kind=supplier_kind,
            supplier_name=supplier_name,
            source_order_type=source_order_type,
            source_order_id=source_order_id,
            doc_date=doc_date,
        )
        return item, receipt, True

    def flush(self) -> list[AutoserviceWarehouseReceiptDoc]:
        if not self._pending:
            return []

        groups: dict[tuple, list[_PendingReceiptLine]] = {}
        for line in self._pending:
            key = (
                line.supplier_kind,
                line.source_order_type,
                line.source_order_id,
                line.doc_date.isoformat(),
            )
            groups.setdefault(key, []).append(line)

        created_docs: list[AutoserviceWarehouseReceiptDoc] = []
        for (_kind, _order_type, _order_id, doc_date_str), lines in groups.items():
            first = lines[0]
            doc = AutoserviceWarehouseReceiptDoc(
                organization_id=self.org_id,
                number=_next_receipt_doc_number(self.db, self.org_id),
                doc_date=first.doc_date,
                supplier_kind=first.supplier_kind,
                supplier_name=first.supplier_name,
                source_order_type=first.source_order_type,
                source_order_id=first.source_order_id,
                repair_order_id=self.repair_order_id,
                created_by=self.user_id,
            )
            self.db.add(doc)
            self.db.flush()
            for line in lines:
                line.receipt.document_id = doc.id
            created_docs.append(doc)

        self._pending.clear()
        self.db.flush()
        return created_docs


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
    source_order_type = "new" if cart_item_type == "new" else "used"
    source_order_id = _purchase_order_id_for_cart_item(
        db,
        order_type=source_order_type,
        cart_item_id=cart_item_id,
    )
    if source_order_id is None:
        raise HTTPException(status_code=400, detail="Строка заказа покупки не найдена")

    batch = ReceiptDocumentBatch(
        db,
        org_id=org_id,
        user_id=user_id,
        repair_order_id=repair_order_id,
    )
    result = batch.add_purchase(
        cart_item_type=cart_item_type,
        cart_item_id=cart_item_id,
        brand=brand,
        article=article,
        name=name,
        quantity=quantity,
        unit_price=unit_price,
        source_order_type=source_order_type,
        source_order_id=source_order_id,
    )
    batch.flush()
    return result


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
    unit: str = "pcs",
    repair_order_id: int | None = None,
) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
    """Create a manual warehouse receipt (no purchase cart line)."""
    batch = ReceiptDocumentBatch(
        db,
        org_id=org_id,
        user_id=user_id,
        repair_order_id=repair_order_id,
    )
    result = batch.add_manual(
        brand=brand,
        article=article,
        name=name,
        quantity=quantity,
        unit_price=unit_price,
        unit=unit,
    )
    batch.flush()
    return result


def transfer_my_parts_to_autoservice(
    db: Session,
    *,
    org_id: str,
    user_id: int,
    product_id: int,
    quantity: int,
    repair_order_id: int | None = None,
) -> tuple[AutoserviceWarehouseItem, AutoserviceWarehouseReceipt, bool]:
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.organization_id == org_id)
        .with_for_update()
        .first()
    )
    if not product:
        raise HTTPException(status_code=400, detail="Товар склада не найден")

    brand = _normalize_brand(product.brand)
    article = _normalize_article(product.article or product.internal_code)
    name = (product.name or article or brand or "Запчасть")[:255]
    unit_price = _money(product.price or 0)

    batch = ReceiptDocumentBatch(
        db,
        org_id=org_id,
        user_id=user_id,
        repair_order_id=repair_order_id,
    )
    result = batch.add_my_parts(
        product=product,
        brand=brand,
        article=article,
        name=name,
        quantity=quantity,
        unit_price=unit_price,
    )
    batch.flush()
    return result


def import_purchase_groups_to_warehouse(
    db: Session,
    *,
    org_id: str,
    user: User,
    groups: list[PurchaseWarehouseImportGroup],
) -> tuple[int, int, int]:
    added = 0
    skipped = 0
    not_found = 0
    batch = ReceiptDocumentBatch(db, org_id=org_id, user_id=user.id)

    for group in groups:
        if group.order_type == "new":
            rows = (
                db.query(GarageNewOrderItem)
                .join(GarageNewOrder, GarageNewOrderItem.order_id == GarageNewOrder.id)
                .filter(
                    GarageNewOrder.user_id == user.id,
                    GarageNewOrderItem.id.in_(group.item_ids),
                )
                .all()
            )
            not_found += len(set(group.item_ids) - {row.id for row in rows})
            for row in rows:
                brand = _normalize_brand(row.brand)
                article = _normalize_article(row.partnumber)
                name = (row.name or "").strip() or article or brand or "Запчасть"
                qty = int(row.quantity or 1)
                price = _money(row.price or 0)
                _, _, created = batch.add_purchase(
                    cart_item_type="new",
                    cart_item_id=row.id,
                    brand=brand,
                    article=article,
                    name=name,
                    quantity=qty,
                    unit_price=price,
                    source_order_type="new",
                    source_order_id=row.order_id,
                )
                if created:
                    added += 1
                else:
                    skipped += 1
        else:
            rows = fetch_used_purchase_items_for_buyer(
                db,
                user=user,
                item_ids=group.item_ids,
            )
            not_found += len(set(group.item_ids) - {row.id for row in rows})
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
                _, _, created = batch.add_purchase(
                    cart_item_type="used",
                    cart_item_id=row.id,
                    brand=brand,
                    article=article,
                    name=name,
                    quantity=qty,
                    unit_price=price,
                    source_order_type="used",
                    source_order_id=row.order_id,
                )
                if created:
                    added += 1
                else:
                    skipped += 1

    batch.flush()
    return added, skipped, not_found


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

    available = autoservice_item_available_qty(item)
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


def recalculate_autoservice_item_quantities(db: Session, *, org_id: str | None = None) -> int:
    """Set item.quantity = sum(receipts) - sum(expenses); keep reserved_qty unchanged."""
    query = db.query(AutoserviceWarehouseItem)
    if org_id:
        query = query.filter(AutoserviceWarehouseItem.organization_id == org_id)
    items = query.all()
    updated = 0
    for item in items:
        received = sum(int(row.quantity or 0) for row in (item.receipts or []))
        spent = sum(int(row.quantity or 0) for row in (item.expenses or []))
        new_qty = max(0, received - spent)
        if int(item.quantity or 0) != new_qty:
            item.quantity = new_qty
            updated += 1
    db.flush()
    return updated


def product_available_qty(product: Product) -> int:
    return max(0, int(product.quantity or 0) - int(getattr(product, "reserved_qty", 0) or 0))


def autoservice_item_available_qty(item: AutoserviceWarehouseItem) -> int:
    return max(
        0,
        int(item.quantity or 0)
        - int(item.reserved_qty or 0)
        - int(getattr(item, "return_reserved_qty", 0) or 0),
    )


def _price_with_markup(
    unit_price,
    markup_percent,
    *,
    floor_rubles: bool = False,
) -> Decimal:
    from decimal import ROUND_DOWN

    value = _money(unit_price) * (Decimal("1") + _money(markup_percent) / Decimal("100"))
    if floor_rubles:
        return Decimal(int(value.to_integral_value(rounding=ROUND_DOWN)))
    return _money(value)


def _shop_parts_for_manual_receipt_line(
    db: Session,
    receipt: AutoserviceWarehouseReceipt,
) -> list[RepairOrderShopPart]:
    if not receipt.repair_order_id:
        return []
    return (
        db.query(RepairOrderShopPart)
        .filter(
            RepairOrderShopPart.order_id == receipt.repair_order_id,
            RepairOrderShopPart.autoservice_stock_item_id == receipt.item_id,
            RepairOrderShopPart.source == "autoservice_stock",
        )
        .all()
    )


def receipt_line_pricing_context(
    db: Session,
    *,
    doc: AutoserviceWarehouseReceiptDoc,
    receipt: AutoserviceWarehouseReceipt,
) -> dict:
    can_edit = doc.supplier_kind == "manual" and (receipt.cart_item_type or "") == "manual"
    if not can_edit:
        return {
            "can_edit_price": False,
            "can_edit_unit": False,
            "unit": "pcs",
            "client_unit_price_override": None,
            "markup_percent": None,
            "automatic_client_unit_price": None,
        }
    shop_parts = _shop_parts_for_manual_receipt_line(db, receipt)
    if not shop_parts:
        item_unit = "pcs"
        if receipt.item and getattr(receipt.item, "unit", None) in ("pcs", "l", "kg"):
            item_unit = receipt.item.unit
        return {
            "can_edit_price": True,
            "can_edit_unit": True,
            "unit": item_unit,
            "client_unit_price_override": None,
            "markup_percent": None,
            "automatic_client_unit_price": None,
        }
    part = shop_parts[0]
    unit = part.unit if part.unit in ("pcs", "l", "kg") else "pcs"
    return {
        "can_edit_price": True,
        "can_edit_unit": True,
        "unit": unit,
        "client_unit_price_override": (
            _money(part.client_unit_price_override)
            if part.client_unit_price_override is not None
            else None
        ),
        "markup_percent": _money(part.markup_percent),
        "automatic_client_unit_price": _price_with_markup(
            receipt.unit_price,
            part.markup_percent,
            floor_rubles=part.source == "rossko",
        ),
    }


def update_manual_receipt_line_prices(
    db: Session,
    *,
    org_id: str,
    doc_id: int,
    line_id: int,
    unit_price: Decimal | None = None,
    client_unit_price_override: Decimal | None = None,
    clear_client_unit_price_override: bool = False,
    unit: str | None = None,
    update_unit_price: bool = False,
    update_client_unit_price_override: bool = False,
    update_unit: bool = False,
) -> AutoserviceWarehouseReceipt:
    doc = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .filter(
            AutoserviceWarehouseReceiptDoc.id == doc_id,
            AutoserviceWarehouseReceiptDoc.organization_id == org_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ поступления не найден")
    if doc.supplier_kind != "manual":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Редактирование цены доступно только для документов «Вручную»",
        )

    receipt = (
        db.query(AutoserviceWarehouseReceipt)
        .options(joinedload(AutoserviceWarehouseReceipt.item))
        .filter(
            AutoserviceWarehouseReceipt.id == line_id,
            AutoserviceWarehouseReceipt.document_id == doc_id,
            AutoserviceWarehouseReceipt.organization_id == org_id,
        )
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Строка поступления не найдена")
    if (receipt.cart_item_type or "") != "manual":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Редактирование цены доступно только для ручных строк",
        )

    item = receipt.item
    if not item:
        raise HTTPException(status_code=404, detail="Позиция склада не найдена")

    if update_unit_price:
        if unit_price is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Укажите закупочную цену",
            )
        price = _money(unit_price)
        receipt.unit_price = price
        item.unit_price = price
        for part in _shop_parts_for_manual_receipt_line(db, receipt):
            part.unit_price = price

    if clear_client_unit_price_override:
        for part in _shop_parts_for_manual_receipt_line(db, receipt):
            part.client_unit_price_override = None
    elif update_client_unit_price_override:
        override = _money(client_unit_price_override or 0)
        for part in _shop_parts_for_manual_receipt_line(db, receipt):
            part.client_unit_price_override = override

    if update_unit:
        if unit not in ("pcs", "l", "kg"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Недопустимая единица измерения",
            )
        for part in _shop_parts_for_manual_receipt_line(db, receipt):
            part.unit = unit

    db.flush()
    return receipt


def _shop_parts_for_item(db: Session, item_id: int) -> list[RepairOrderShopPart]:
    return (
        db.query(RepairOrderShopPart)
        .filter(RepairOrderShopPart.autoservice_stock_item_id == item_id)
        .all()
    )


def _shop_parts_for_receipt_line(
    db: Session,
    receipt: AutoserviceWarehouseReceipt,
) -> list[RepairOrderShopPart]:
    by_receipt = (
        db.query(RepairOrderShopPart)
        .filter(RepairOrderShopPart.warehouse_receipt_id == receipt.id)
        .all()
    )
    if by_receipt:
        return by_receipt
    if receipt.cart_item_type and receipt.cart_item_id is not None:
        linked = (
            db.query(RepairOrderShopPart)
            .filter(
                RepairOrderShopPart.cart_item_type == receipt.cart_item_type,
                RepairOrderShopPart.cart_item_id == receipt.cart_item_id,
            )
            .all()
        )
        if linked:
            return linked
    if receipt.repair_order_id and receipt.item_id:
        return (
            db.query(RepairOrderShopPart)
            .filter(
                RepairOrderShopPart.order_id == receipt.repair_order_id,
                RepairOrderShopPart.autoservice_stock_item_id == receipt.item_id,
            )
            .all()
        )
    return _shop_parts_for_item(db, receipt.item_id)


def update_receipt_doc_date(
    db: Session,
    *,
    org_id: str,
    doc_id: int,
    doc_date: date,
) -> AutoserviceWarehouseReceiptDoc:
    doc = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .options(joinedload(AutoserviceWarehouseReceiptDoc.lines))
        .filter(
            AutoserviceWarehouseReceiptDoc.id == doc_id,
            AutoserviceWarehouseReceiptDoc.organization_id == org_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ поступления не найден")
    doc.doc_date = doc_date
    for line in doc.lines or []:
        line.created_at = doc_date
    db.flush()
    return doc


def update_receipt_line_details(
    db: Session,
    *,
    org_id: str,
    doc_id: int,
    line_id: int,
    brand: str,
    article: str,
    name: str,
    quantity: Decimal,
    unit: str,
    unit_price: Decimal,
) -> AutoserviceWarehouseReceipt:
    from app.services.repair_order_stock_reserve import (
        apply_shop_part_reservation,
        release_shop_part_reservation,
    )

    doc = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .filter(
            AutoserviceWarehouseReceiptDoc.id == doc_id,
            AutoserviceWarehouseReceiptDoc.organization_id == org_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ поступления не найден")

    receipt = (
        db.query(AutoserviceWarehouseReceipt)
        .options(joinedload(AutoserviceWarehouseReceipt.item))
        .filter(
            AutoserviceWarehouseReceipt.id == line_id,
            AutoserviceWarehouseReceipt.document_id == doc_id,
            AutoserviceWarehouseReceipt.organization_id == org_id,
        )
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Строка поступления не найдена")

    item = receipt.item
    if not item:
        raise HTTPException(status_code=404, detail="Позиция склада не найдена")

    name_norm = (name or "").strip()[:255]
    if not name_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите наименование",
        )

    unit_norm = unit if unit in ("pcs", "l", "kg") else "pcs"
    brand_norm = _normalize_brand(brand)
    article_norm = _normalize_article(article)
    price = _money(unit_price)
    qty_saved, qty_int = _shop_part_qty_values(quantity, unit_norm)
    old_receipt_qty = int(receipt.quantity or 0)
    qty_delta = qty_int - old_receipt_qty
    new_item_qty = int(item.quantity or 0) + qty_delta
    protected_item_qty = (
        int(item.reserved_qty or 0)
        + int(getattr(item, "return_reserved_qty", 0) or 0)
    )
    protected_receipt_qty = (
        int(getattr(receipt, "returned_qty", 0) or 0)
        + int(getattr(receipt, "return_reserved_qty", 0) or 0)
    )
    if qty_int < protected_receipt_qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя уменьшить партию ниже количества в возвратах",
        )
    if new_item_qty < protected_item_qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя уменьшить количество ниже зарезервированного остатка",
        )
    if new_item_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостаточно остатка на складе",
        )

    if article_norm and (
        brand_norm != item.brand or article_norm != item.article
    ):
        conflict = (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.organization_id == org_id,
                AutoserviceWarehouseItem.brand == brand_norm,
                AutoserviceWarehouseItem.article == article_norm,
                AutoserviceWarehouseItem.id != item.id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="На складе уже есть товар с таким брендом и артикулом",
            )

    item.brand = brand_norm
    item.article = article_norm
    item.name = name_norm
    item.unit = unit_norm
    item.unit_price = price
    item.quantity = new_item_qty

    receipt.quantity = qty_int
    receipt.unit_price = price

    linked_parts = _shop_parts_for_receipt_line(db, receipt)
    for part in linked_parts:
        if part.source in ("warehouse", "autoservice_stock"):
            release_shop_part_reservation(db, part)
        part.qty = qty_saved
        part.title = name_norm
        part.brand = brand_norm or None
        part.partnumber = article_norm or None
        part.unit = unit_norm
        part.unit_price = price
        part.warehouse_receipt_id = receipt.id
        if part.source in ("warehouse", "autoservice_stock"):
            apply_shop_part_reservation(db, part)

    db.flush()
    return receipt


def _shop_part_qty_values(qty, unit: str) -> tuple[Decimal, int]:
    qty_dec = Decimal(str(qty or 1))
    unit_norm = unit if unit in ("pcs", "l", "kg") else "pcs"
    if unit_norm == "pcs":
        if qty_dec != qty_dec.to_integral_value():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Количество в штуках должно быть целым числом",
            )
        qty_int = max(1, int(qty_dec))
        return Decimal(qty_int), qty_int
    qty_saved = qty_dec.quantize(Decimal("0.001"))
    if qty_saved <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Количество должно быть больше 0",
        )
    qty_int = max(1, int(qty_saved.quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
    return qty_saved, qty_int


def manual_receipt_for_shop_part(
    db: Session,
    *,
    org_id: str,
    part: RepairOrderShopPart,
) -> AutoserviceWarehouseReceipt | None:
    if part.warehouse_receipt_id:
        receipt = (
            db.query(AutoserviceWarehouseReceipt)
            .filter(
                AutoserviceWarehouseReceipt.id == part.warehouse_receipt_id,
                AutoserviceWarehouseReceipt.organization_id == org_id,
                AutoserviceWarehouseReceipt.cart_item_type == "manual",
            )
            .first()
        )
        if receipt:
            return receipt
    if not part.order_id or not part.autoservice_stock_item_id:
        return None
    receipts = (
        db.query(AutoserviceWarehouseReceipt)
        .filter(
            AutoserviceWarehouseReceipt.organization_id == org_id,
            AutoserviceWarehouseReceipt.repair_order_id == part.order_id,
            AutoserviceWarehouseReceipt.item_id == part.autoservice_stock_item_id,
            AutoserviceWarehouseReceipt.cart_item_type == "manual",
        )
        .order_by(AutoserviceWarehouseReceipt.id.asc())
        .all()
    )
    if not receipts:
        return None
    if len(receipts) == 1:
        return receipts[0]
    part_qty_int = max(
        1,
        int(Decimal(str(part.qty or 1)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
    )
    for receipt in receipts:
        if int(receipt.quantity or 0) == part_qty_int:
            return receipt
    return receipts[0]


def shop_part_is_manual_editable(
    db: Session,
    *,
    org_id: str,
    part: RepairOrderShopPart,
) -> bool:
    from app.services.repair_order_purchase_import import shop_part_is_imported

    if shop_part_is_imported(part):
        return False
    if part.source == "warehouse":
        return False
    if part.source in ("manual", "rossko"):
        return True
    if part.source == "autoservice_stock" and part.autoservice_stock_item_id:
        return manual_receipt_for_shop_part(db, org_id=org_id, part=part) is not None
    return False


def update_manual_shop_part(
    db: Session,
    *,
    org_id: str,
    order_id: int,
    part_id: int,
    brand: str,
    article: str,
    name: str,
    quantity: Decimal,
    unit: str,
    unit_price: Decimal,
) -> RepairOrderShopPart:
    from app.services.repair_order_stock_reserve import (
        apply_shop_part_reservation,
        release_shop_part_reservation,
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
    if not shop_part_is_manual_editable(db, org_id=org_id, part=part):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Редактирование доступно только для позиций, добавленных вручную",
        )
    if part.source in ("manual", "rossko"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сохраните заказ-наряд перед редактированием позиции на складе",
        )

    receipt = manual_receipt_for_shop_part(db, org_id=org_id, part=part)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не найдено поступление для этой позиции",
        )

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
        raise HTTPException(status_code=404, detail="Позиция склада не найдена")

    name_norm = (name or "").strip()[:255]
    if not name_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите наименование",
        )

    unit_norm = unit if unit in ("pcs", "l", "kg") else "pcs"
    qty_saved, qty_int = _shop_part_qty_values(quantity, unit_norm)
    price = _money(unit_price)
    brand_norm = _normalize_brand(brand)
    article_norm = _normalize_article(article)

    if article_norm and (
        brand_norm != item.brand or article_norm != item.article
    ):
        conflict = (
            db.query(AutoserviceWarehouseItem)
            .filter(
                AutoserviceWarehouseItem.organization_id == org_id,
                AutoserviceWarehouseItem.brand == brand_norm,
                AutoserviceWarehouseItem.article == article_norm,
                AutoserviceWarehouseItem.id != item.id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="На складе уже есть товар с таким брендом и артикулом",
            )

    old_receipt_qty = int(receipt.quantity or 0)
    qty_delta = qty_int - old_receipt_qty
    new_item_qty = int(item.quantity or 0) + qty_delta
    protected_item_qty = (
        int(item.reserved_qty or 0)
        + int(getattr(item, "return_reserved_qty", 0) or 0)
    )
    protected_receipt_qty = (
        int(getattr(receipt, "returned_qty", 0) or 0)
        + int(getattr(receipt, "return_reserved_qty", 0) or 0)
    )
    if qty_int < protected_receipt_qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя уменьшить партию ниже количества в возвратах",
        )
    if new_item_qty < protected_item_qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя уменьшить количество ниже зарезервированного остатка",
        )
    if new_item_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Недостаточно остатка на складе",
        )

    item.quantity = new_item_qty
    item.brand = brand_norm
    item.article = article_norm
    item.name = name_norm
    item.unit_price = price

    receipt.quantity = qty_int
    receipt.unit_price = price

    release_shop_part_reservation(db, part)
    part.qty = qty_saved
    apply_shop_part_reservation(db, part)

    part.title = name_norm
    part.brand = brand_norm or None
    part.partnumber = article_norm or None
    part.unit = unit_norm
    part.unit_price = price
    part.warehouse_receipt_id = receipt.id

    db.flush()
    return part


def update_autoservice_warehouse_item(
    db: Session,
    *,
    org_id: str,
    item_id: int,
    brand: str,
    article: str,
    name: str,
    unit: str,
    unit_price: Decimal,
) -> AutoserviceWarehouseItem:
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
        raise HTTPException(status_code=404, detail="Позиция склада не найдена")

    name_norm = (name or "").strip()[:255]
    if not name_norm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Укажите наименование",
        )

    unit_norm = unit if unit in ("pcs", "l", "kg") else "pcs"
    brand_norm = _normalize_brand(brand)
    article_norm = _normalize_article(article)

    if brand_norm != item.brand or article_norm != item.article:
        _ensure_unique_warehouse_item_identity(
            db,
            org_id=org_id,
            item_id=item.id,
            brand=brand_norm,
            article=article_norm,
        )

    item.brand = brand_norm
    item.article = article_norm
    item.name = name_norm
    item.unit = unit_norm
    item.unit_price = _money(unit_price)

    linked_parts = (
        db.query(RepairOrderShopPart)
        .filter(RepairOrderShopPart.autoservice_stock_item_id == item.id)
        .all()
    )
    for part in linked_parts:
        part.title = name_norm
        part.brand = brand_norm or None
        part.partnumber = article_norm or None
        part.unit = unit_norm

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_warehouse_item_identity_conflict_message(
                brand=brand_norm,
                article=article_norm,
            ),
        ) from exc
    return item
