from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import HTTPException, status
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
from app.models.repair_order import RepairOrder
from app.schemas.autoservice_warehouse import PurchaseWarehouseImportGroup

SupplierKind = Literal["manual", "my_parts", "purchase_new", "purchase_used"]


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _normalize_brand(value: str | None) -> str:
    return (value or "").strip()[:120]


def _normalize_article(value: str | None) -> str:
    return (value or "").strip()[:120]


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
    if not article_norm:
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
    ) -> None:
        self.db = db
        self.org_id = org_id
        self.user_id = user_id
        self.repair_order_id = repair_order_id
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
        receipt = AutoserviceWarehouseReceipt(
            organization_id=self.org_id,
            item_id=item.id,
            quantity=quantity,
            unit_price=_money(unit_price),
            cart_item_type=cart_item_type,
            cart_item_id=cart_item_id,
            repair_order_id=self.repair_order_id,
            created_by=self.user_id,
            created_at=doc_date or date.today(),
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
                doc_date=doc_date or date.today(),
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
    user_id: int,
    groups: list[PurchaseWarehouseImportGroup],
) -> tuple[int, int]:
    added = 0
    skipped = 0
    batch = ReceiptDocumentBatch(db, org_id=org_id, user_id=user_id)

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
    return max(0, int(item.quantity or 0) - int(item.reserved_qty or 0))
