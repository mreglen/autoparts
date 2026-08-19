from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
    AutoserviceWarehouseReceiptDoc,
    AutoserviceWarehouseReturnRequest,
)
from app.models.garage_new_orders import GarageNewOrder
from app.models.garage_used_orders import GarageUsedOrder
from app.models.user import User
from app.utils.autoservice_warehouse_supplier import resolve_autoservice_supplier_display_name

ACTIVE_RETURN_STATUSES = frozenset({"requested", "reviewing", "approved", "sent"})
RETURN_TRANSITIONS = {
    "requested": frozenset({"reviewing", "approved", "rejected", "cancelled"}),
    "reviewing": frozenset({"approved", "rejected", "cancelled"}),
    "approved": frozenset({"sent", "rejected", "cancelled"}),
    "sent": frozenset({"refunded"}),
    "refunded": frozenset({"closed"}),
    "rejected": frozenset(),
    "cancelled": frozenset(),
    "closed": frozenset(),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _photo_urls(row: AutoserviceWarehouseReturnRequest) -> list[str]:
    try:
        parsed = json.loads(row.photo_urls_json or "[]")
    except (TypeError, ValueError):
        return []
    return [str(value) for value in parsed if value]


def _provider_meta(
    db: Session,
    *,
    source_order_type: str,
    source_order_id: int,
    supplier_name: str,
) -> tuple[str, str | None, str]:
    if source_order_type == "used":
        order = (
            db.query(GarageUsedOrder)
            .filter(GarageUsedOrder.id == source_order_id)
            .first()
        )
        return "organization", (order.organization_id if order else None), "internal"

    order = (
        db.query(GarageNewOrder)
        .filter(GarageNewOrder.id == source_order_id)
        .first()
    )
    if order and order.rossko_order_id:
        return "rossko", None, "manual"
    return "external_new", None, "manual"


def _active_return_for_receipt(
    db: Session,
    receipt_id: int,
) -> AutoserviceWarehouseReturnRequest | None:
    return (
        db.query(AutoserviceWarehouseReturnRequest)
        .filter(
            AutoserviceWarehouseReturnRequest.receipt_id == receipt_id,
            AutoserviceWarehouseReturnRequest.status_code.in_(ACTIVE_RETURN_STATUSES),
        )
        .first()
    )


def serialize_warehouse_return(row: AutoserviceWarehouseReturnRequest) -> dict:
    item = row.item
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "supplier_organization_id": row.supplier_organization_id,
        "receipt_id": row.receipt_id,
        "item_id": row.item_id,
        "source_order_type": row.source_order_type,
        "source_order_id": row.source_order_id,
        "cart_item_type": row.cart_item_type,
        "cart_item_id": row.cart_item_id,
        "provider_kind": row.provider_kind,
        "processing_mode": row.processing_mode,
        "supplier_name": row.supplier_name,
        "brand": (item.brand if item else "") or "",
        "article": (item.article if item else "") or "",
        "name": (item.name if item else "") or "",
        "quantity": int(row.quantity or 0),
        "unit_price": _money(row.unit_price),
        "reason": row.reason,
        "comment": row.comment,
        "photo_urls": _photo_urls(row),
        "status_code": row.status_code,
        "seller_note": row.seller_note,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "status_changed_at": row.status_changed_at,
    }


def list_purchase_lots(db: Session, *, org_id: str) -> list[dict]:
    receipts = (
        db.query(AutoserviceWarehouseReceipt)
        .options(
            joinedload(AutoserviceWarehouseReceipt.item),
            joinedload(AutoserviceWarehouseReceipt.document),
        )
        .filter(
            AutoserviceWarehouseReceipt.organization_id == org_id,
            AutoserviceWarehouseReceipt.cart_item_type.in_(("new", "used")),
        )
        .order_by(
            AutoserviceWarehouseReceipt.created_at.desc(),
            AutoserviceWarehouseReceipt.id.desc(),
        )
        .all()
    )
    active_rows = (
        db.query(AutoserviceWarehouseReturnRequest)
        .options(joinedload(AutoserviceWarehouseReturnRequest.item))
        .filter(
            AutoserviceWarehouseReturnRequest.organization_id == org_id,
            AutoserviceWarehouseReturnRequest.status_code.in_(ACTIVE_RETURN_STATUSES),
        )
        .all()
    )
    active_by_receipt = {row.receipt_id: row for row in active_rows}

    result: list[dict] = []
    for receipt in receipts:
        item = receipt.item
        doc = receipt.document
        if not item or not doc:
            continue
        source_type = doc.source_order_type or receipt.cart_item_type
        source_order_id = doc.source_order_id
        if source_type not in ("new", "used") or source_order_id is None:
            continue
        provider_kind, _, _ = _provider_meta(
            db,
            source_order_type=source_type,
            source_order_id=int(source_order_id),
            supplier_name=doc.supplier_name,
        )
        receipt_remaining = max(
            0,
            int(receipt.quantity or 0)
            - int(getattr(receipt, "returned_qty", 0) or 0)
            - int(getattr(receipt, "return_reserved_qty", 0) or 0),
        )
        aggregate_remaining = max(
            0,
            int(item.quantity or 0)
            - int(getattr(item, "return_reserved_qty", 0) or 0),
        )
        max_returnable = (
            0
            if int(item.reserved_qty or 0) > 0
            else min(receipt_remaining, aggregate_remaining)
        )
        active = active_by_receipt.get(receipt.id)
        result.append(
            {
                "receipt_id": receipt.id,
                "document_id": receipt.document_id,
                "item_id": item.id,
                "source_order_type": source_type,
                "source_order_id": int(source_order_id),
                "cart_item_type": receipt.cart_item_type,
                "cart_item_id": int(receipt.cart_item_id),
                "supplier_name": resolve_autoservice_supplier_display_name(
                    db,
                    supplier_name=doc.supplier_name,
                    source_order_type=source_type,
                    source_order_id=int(source_order_id),
                ),
                "provider_kind": provider_kind,
                "brand": item.brand or "",
                "article": item.article or "",
                "name": item.name or "",
                "unit": item.unit if item.unit in ("pcs", "l", "kg") else "pcs",
                "quantity": int(receipt.quantity or 0),
                "returned_qty": int(getattr(receipt, "returned_qty", 0) or 0),
                "return_reserved_qty": int(
                    getattr(receipt, "return_reserved_qty", 0) or 0
                ),
                "item_quantity": int(item.quantity or 0),
                "item_reserved_qty": int(item.reserved_qty or 0),
                "item_return_reserved_qty": int(
                    getattr(item, "return_reserved_qty", 0) or 0
                ),
                "max_returnable_qty": max_returnable,
                "unit_price": _money(receipt.unit_price),
                "created_at": receipt.created_at,
                "active_return": serialize_warehouse_return(active) if active else None,
            }
        )
    return result


def create_warehouse_return(
    db: Session,
    *,
    org_id: str,
    user: User,
    receipt_id: int,
    quantity: int,
    reason: str,
    comment: str | None,
    photo_urls: list[str],
) -> AutoserviceWarehouseReturnRequest:
    receipt = (
        db.query(AutoserviceWarehouseReceipt)
        .filter(
            AutoserviceWarehouseReceipt.id == receipt_id,
            AutoserviceWarehouseReceipt.organization_id == org_id,
        )
        .with_for_update()
        .first()
    )
    if not receipt or receipt.cart_item_type not in ("new", "used"):
        raise HTTPException(status_code=404, detail="Партия закупки не найдена")
    item = (
        db.query(AutoserviceWarehouseItem)
        .filter(
            AutoserviceWarehouseItem.id == receipt.item_id,
            AutoserviceWarehouseItem.organization_id == org_id,
        )
        .with_for_update()
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Товар склада не найден")
    if int(item.reserved_qty or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Сначала удалите товар из заказ-наряда, чтобы снять резерв, "
                "затем оформите возврат"
            ),
        )
    if _active_return_for_receipt(db, receipt.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По этой партии уже есть активная заявка на возврат",
        )

    qty = int(quantity or 0)
    receipt_remaining = max(
        0,
        int(receipt.quantity or 0)
        - int(getattr(receipt, "returned_qty", 0) or 0)
        - int(getattr(receipt, "return_reserved_qty", 0) or 0),
    )
    item_remaining = max(
        0,
        int(item.quantity or 0)
        - int(getattr(item, "return_reserved_qty", 0) or 0),
    )
    maximum = min(receipt_remaining, item_remaining)
    if qty <= 0 or qty > maximum:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Для возврата доступно не более {maximum} шт.",
        )

    doc: AutoserviceWarehouseReceiptDoc | None = receipt.document
    source_type = (doc.source_order_type if doc else None) or receipt.cart_item_type
    source_order_id = doc.source_order_id if doc else None
    if source_type not in ("new", "used") or source_order_id is None:
        raise HTTPException(status_code=400, detail="Не удалось определить исходный заказ")
    supplier_name = (doc.supplier_name if doc else None) or "Поставщик"
    provider_kind, supplier_org_id, processing_mode = _provider_meta(
        db,
        source_order_type=source_type,
        source_order_id=int(source_order_id),
        supplier_name=supplier_name,
    )
    if source_type == "used" and not supplier_org_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Не удалось определить организацию-продавца исходного заказа",
        )

    now = _now()
    row = AutoserviceWarehouseReturnRequest(
        organization_id=org_id,
        supplier_organization_id=supplier_org_id,
        receipt_id=receipt.id,
        item_id=item.id,
        source_order_type=source_type,
        source_order_id=int(source_order_id),
        cart_item_type=receipt.cart_item_type,
        cart_item_id=int(receipt.cart_item_id),
        provider_kind=provider_kind,
        processing_mode=processing_mode,
        supplier_name=supplier_name[:255],
        quantity=qty,
        unit_price=_money(receipt.unit_price),
        reason=reason,
        comment=(comment or "").strip() or None,
        photo_urls_json=json.dumps(photo_urls[:5], ensure_ascii=False),
        status_code="requested",
        created_by=user.id,
        status_changed_at=now,
    )
    receipt.return_reserved_qty = int(
        getattr(receipt, "return_reserved_qty", 0) or 0
    ) + qty
    item.return_reserved_qty = int(getattr(item, "return_reserved_qty", 0) or 0) + qty
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По этой партии уже есть активная заявка на возврат",
        ) from exc
    db.refresh(row)
    return (
        db.query(AutoserviceWarehouseReturnRequest)
        .options(joinedload(AutoserviceWarehouseReturnRequest.item))
        .filter(AutoserviceWarehouseReturnRequest.id == row.id)
        .first()
    )


def list_warehouse_returns(
    db: Session,
    *,
    org_id: str | None = None,
    supplier_org_id: str | None = None,
    external_only: bool = False,
) -> list[AutoserviceWarehouseReturnRequest]:
    query = db.query(AutoserviceWarehouseReturnRequest).options(
        joinedload(AutoserviceWarehouseReturnRequest.item)
    )
    if org_id is not None:
        query = query.filter(AutoserviceWarehouseReturnRequest.organization_id == org_id)
    if supplier_org_id is not None:
        query = query.filter(
            AutoserviceWarehouseReturnRequest.supplier_organization_id
            == supplier_org_id
        )
    if external_only:
        query = query.filter(
            AutoserviceWarehouseReturnRequest.provider_kind.in_(
                ("rossko", "external_new")
            )
        )
    return query.order_by(
        AutoserviceWarehouseReturnRequest.created_at.desc(),
        AutoserviceWarehouseReturnRequest.id.desc(),
    ).all()


def update_warehouse_return_status(
    db: Session,
    *,
    return_id: int,
    new_status: str,
    seller_note: str | None,
    supplier_org_id: str | None = None,
    buyer_org_id: str | None = None,
    is_admin: bool = False,
) -> AutoserviceWarehouseReturnRequest:
    row = (
        db.query(AutoserviceWarehouseReturnRequest)
        .filter(AutoserviceWarehouseReturnRequest.id == return_id)
        .with_for_update()
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Заявка на возврат не найдена")
    if not is_admin:
        supplier_match = (
            supplier_org_id is not None
            and row.supplier_organization_id == supplier_org_id
        )
        buyer_cancel = (
            buyer_org_id is not None
            and row.organization_id == buyer_org_id
            and new_status == "cancelled"
        )
        if not supplier_match and not buyer_cancel:
            raise HTTPException(status_code=403, detail="Нет доступа к заявке")

    allowed = RETURN_TRANSITIONS.get(row.status_code, frozenset())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый переход {row.status_code} → {new_status}",
        )
    note = (seller_note or "").strip() or None
    if new_status == "rejected" and not note:
        raise HTTPException(status_code=400, detail="Укажите причину отклонения")

    item = (
        db.query(AutoserviceWarehouseItem)
        .filter(AutoserviceWarehouseItem.id == row.item_id)
        .with_for_update()
        .first()
    )
    receipt = (
        db.query(AutoserviceWarehouseReceipt)
        .filter(AutoserviceWarehouseReceipt.id == row.receipt_id)
        .with_for_update()
        .first()
    )
    if not item or not receipt:
        raise HTTPException(status_code=409, detail="Связанная партия больше недоступна")

    qty = int(row.quantity or 0)
    if new_status in ("rejected", "cancelled"):
        receipt.return_reserved_qty = max(
            0, int(getattr(receipt, "return_reserved_qty", 0) or 0) - qty
        )
        item.return_reserved_qty = max(
            0, int(getattr(item, "return_reserved_qty", 0) or 0) - qty
        )
    elif new_status == "sent":
        if int(item.quantity or 0) < qty:
            raise HTTPException(status_code=409, detail="Недостаточно товара на складе")
        item.quantity = int(item.quantity or 0) - qty
        item.return_reserved_qty = max(
            0, int(getattr(item, "return_reserved_qty", 0) or 0) - qty
        )
        receipt.return_reserved_qty = max(
            0, int(getattr(receipt, "return_reserved_qty", 0) or 0) - qty
        )
        receipt.returned_qty = int(getattr(receipt, "returned_qty", 0) or 0) + qty
        db.add(
            AutoserviceWarehouseExpense(
                organization_id=row.organization_id,
                item_id=row.item_id,
                quantity=qty,
                unit_price=_money(row.unit_price),
                reason=f"Возврат поставщику, заявка №{row.id}",
                return_request_id=row.id,
                created_by=row.created_by,
            )
        )

    row.status_code = new_status
    row.seller_note = note
    row.status_changed_at = _now()
    db.commit()
    db.refresh(row)
    return row
