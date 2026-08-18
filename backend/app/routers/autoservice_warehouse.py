from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
)
from app.models.user import User
from app.schemas.autoservice_warehouse import (
    AutoserviceWarehouseExpenseCreate,
    AutoserviceWarehouseExpenseView,
    AutoserviceWarehouseImportResult,
    AutoserviceWarehouseItemView,
    AutoserviceWarehouseManualReceiptIn,
    AutoserviceWarehouseReceiptSuggestView,
    AutoserviceWarehouseReceiptView,
    PurchaseWarehouseImportIn,
)
from app.services.autoservice_warehouse_service import (
    autoservice_item_available_qty,
    create_autoservice_expense,
    import_purchase_groups_to_warehouse,
    receipt_manual_line,
)
from app.utils.autoservice_access import require_autoservice_staff

router = APIRouter(tags=["Autoservice Warehouse"])


def _creator_name(user) -> str | None:
    if not user:
        return None
    initials = f"{user.first_name[0]}." if user.first_name else ""
    if user.patronymic:
        initials += f"{user.patronymic[0]}."
    return f"{user.last_name or ''} {initials}".strip() or None


def _item_view(item: AutoserviceWarehouseItem) -> AutoserviceWarehouseItemView:
    return AutoserviceWarehouseItemView(
        id=item.id,
        brand=item.brand or "",
        article=item.article or "",
        name=item.name,
        quantity=int(item.quantity or 0),
        reserved_qty=int(item.reserved_qty or 0),
        available_qty=autoservice_item_available_qty(item),
        unit_price=item.unit_price,
    )


@router.get(
    "/autoservice/warehouse/items",
    response_model=list[AutoserviceWarehouseItemView],
)
def list_autoservice_warehouse_items(
    q: str = Query("", max_length=120),
    available_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(AutoserviceWarehouseItem).filter(
        AutoserviceWarehouseItem.organization_id == org_id,
    )
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            (AutoserviceWarehouseItem.name.ilike(like))
            | (AutoserviceWarehouseItem.article.ilike(like))
            | (AutoserviceWarehouseItem.brand.ilike(like))
        )
    rows = query.order_by(
        AutoserviceWarehouseItem.name.asc(),
        AutoserviceWarehouseItem.id.asc(),
    ).limit(200).all()
    if available_only:
        rows = [row for row in rows if autoservice_item_available_qty(row) > 0]
    return [_item_view(row) for row in rows]


@router.get(
    "/autoservice/warehouse/receipts",
    response_model=list[AutoserviceWarehouseReceiptView],
)
def list_autoservice_warehouse_receipts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    rows = (
        db.query(AutoserviceWarehouseReceipt)
        .options(
            joinedload(AutoserviceWarehouseReceipt.item),
            joinedload(AutoserviceWarehouseReceipt.creator),
        )
        .filter(AutoserviceWarehouseReceipt.organization_id == org_id)
        .order_by(
            AutoserviceWarehouseReceipt.created_at.desc(),
            AutoserviceWarehouseReceipt.id.desc(),
        )
        .limit(500)
        .all()
    )
    result = []
    for row in rows:
        item = row.item
        result.append(
            AutoserviceWarehouseReceiptView(
                id=row.id,
                item_id=row.item_id,
                brand=item.brand if item else "",
                article=item.article if item else "",
                name=item.name if item else "",
                quantity=int(row.quantity or 0),
                unit_price=row.unit_price,
                cart_item_type=row.cart_item_type,
                cart_item_id=row.cart_item_id,
                repair_order_id=row.repair_order_id,
                created_at=row.created_at,
                creator_name=_creator_name(row.creator),
            )
        )
    return result


@router.get(
    "/autoservice/warehouse/receipts/suggest",
    response_model=list[AutoserviceWarehouseReceiptSuggestView],
)
def suggest_autoservice_warehouse_receipts(
    field: Literal["brand", "article", "name"] = Query("name"),
    q: str = Query("", max_length=120),
    limit: int = Query(15, ge=1, le=30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    term = (q or "").strip()
    query = (
        db.query(AutoserviceWarehouseReceipt, AutoserviceWarehouseItem)
        .join(
            AutoserviceWarehouseItem,
            AutoserviceWarehouseReceipt.item_id == AutoserviceWarehouseItem.id,
        )
        .filter(AutoserviceWarehouseReceipt.organization_id == org_id)
    )
    if term:
        like = f"%{term}%"
        if field == "brand":
            query = query.filter(AutoserviceWarehouseItem.brand.ilike(like))
        elif field == "article":
            query = query.filter(AutoserviceWarehouseItem.article.ilike(like))
        else:
            query = query.filter(AutoserviceWarehouseItem.name.ilike(like))
    rows = (
        query.order_by(
            AutoserviceWarehouseReceipt.created_at.desc(),
            AutoserviceWarehouseReceipt.id.desc(),
        )
        .limit(400)
        .all()
    )

    seen: set[tuple[str, str, str]] = set()
    result: list[AutoserviceWarehouseReceiptSuggestView] = []
    for receipt, item in rows:
        brand = (item.brand or "").strip()
        article = (item.article or "").strip()
        name = (item.name or "").strip()
        if not name:
            continue
        key = (brand, article, name)
        if key in seen:
            continue
        seen.add(key)
        result.append(
            AutoserviceWarehouseReceiptSuggestView(
                brand=brand,
                article=article,
                name=name,
                unit_price=receipt.unit_price,
            )
        )
        if len(result) >= limit:
            break
    return result


@router.get(
    "/autoservice/warehouse/expenses",
    response_model=list[AutoserviceWarehouseExpenseView],
)
def list_autoservice_warehouse_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    rows = (
        db.query(AutoserviceWarehouseExpense)
        .options(
            joinedload(AutoserviceWarehouseExpense.item),
            joinedload(AutoserviceWarehouseExpense.creator),
        )
        .filter(AutoserviceWarehouseExpense.organization_id == org_id)
        .order_by(
            AutoserviceWarehouseExpense.created_at.desc(),
            AutoserviceWarehouseExpense.id.desc(),
        )
        .limit(500)
        .all()
    )
    result = []
    for row in rows:
        item = row.item
        result.append(
            AutoserviceWarehouseExpenseView(
                id=row.id,
                item_id=row.item_id,
                brand=item.brand if item else "",
                article=item.article if item else "",
                name=item.name if item else "",
                quantity=int(row.quantity or 0),
                unit_price=row.unit_price,
                reason=row.reason,
                created_at=row.created_at,
                creator_name=_creator_name(row.creator),
            )
        )
    return result


@router.post(
    "/autoservice/warehouse/from-purchases",
    response_model=AutoserviceWarehouseImportResult,
)
def import_purchases_to_autoservice_warehouse(
    payload: PurchaseWarehouseImportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    added, skipped = import_purchase_groups_to_warehouse(
        db,
        org_id=org_id,
        user_id=current_user.id,
        groups=payload.groups,
    )
    db.commit()
    return AutoserviceWarehouseImportResult(added_items=added, skipped_items=skipped)


@router.post(
    "/autoservice/warehouse/receipts",
    response_model=AutoserviceWarehouseReceiptView,
)
def create_autoservice_warehouse_receipt(
    payload: AutoserviceWarehouseManualReceiptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    item, receipt, _created = receipt_manual_line(
        db,
        org_id=org_id,
        user_id=current_user.id,
        brand=payload.brand,
        article=payload.article,
        name=payload.name,
        quantity=payload.quantity,
        unit_price=payload.unit_price,
    )
    db.commit()
    db.refresh(receipt)
    db.refresh(item)
    return AutoserviceWarehouseReceiptView(
        id=receipt.id,
        item_id=receipt.item_id,
        brand=item.brand or "",
        article=item.article or "",
        name=item.name,
        quantity=int(receipt.quantity or 0),
        unit_price=receipt.unit_price,
        cart_item_type=receipt.cart_item_type,
        cart_item_id=receipt.cart_item_id,
        repair_order_id=receipt.repair_order_id,
        created_at=receipt.created_at,
        creator_name=_creator_name(current_user),
    )


@router.post(
    "/autoservice/warehouse/expenses",
    response_model=AutoserviceWarehouseExpenseView,
)
def create_autoservice_warehouse_expense(
    payload: AutoserviceWarehouseExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    expense = create_autoservice_expense(
        db,
        org_id=org_id,
        user_id=current_user.id,
        item_id=payload.item_id,
        quantity=payload.quantity,
        reason=payload.reason,
    )
    db.commit()
    db.refresh(expense)
    item = expense.item or db.query(AutoserviceWarehouseItem).get(expense.item_id)
    return AutoserviceWarehouseExpenseView(
        id=expense.id,
        item_id=expense.item_id,
        brand=item.brand if item else "",
        article=item.article if item else "",
        name=item.name if item else "",
        quantity=int(expense.quantity or 0),
        unit_price=expense.unit_price,
        reason=expense.reason,
        created_at=expense.created_at,
        creator_name=_creator_name(current_user),
    )
