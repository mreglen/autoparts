from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_warehouse import (
    AutoserviceWarehouseExpense,
    AutoserviceWarehouseItem,
    AutoserviceWarehouseReceipt,
    AutoserviceWarehouseReceiptDoc,
)
from app.models.user import User
from app.schemas.autoservice_warehouse import (
    AutoserviceWarehouseExpenseCreate,
    AutoserviceWarehouseExpenseView,
    AutoserviceWarehouseImportResult,
    AutoserviceWarehouseItemView,
    AutoserviceWarehouseItemUpdate,
    AutoserviceWarehouseManualReceiptIn,
    AutoserviceWarehouseReceiptDocDetailView,
    AutoserviceWarehouseReceiptDocListView,
    AutoserviceWarehouseReceiptLinePriceUpdate,
    AutoserviceWarehouseReceiptSuggestView,
    AutoserviceWarehouseReceiptView,
    PurchaseWarehouseImportIn,
)
from app.services.autoservice_warehouse_service import (
    autoservice_item_available_qty,
    create_autoservice_expense,
    import_purchase_groups_to_warehouse,
    receipt_line_pricing_context,
    receipt_manual_line,
    update_autoservice_warehouse_item,
    update_manual_receipt_line_prices,
)
from app.utils.autoservice_access import require_autoservice_staff

router = APIRouter(tags=["Autoservice Warehouse"])


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _creator_name(user) -> str | None:
    if not user:
        return None
    initials = f"{user.first_name[0]}." if user.first_name else ""
    if user.patronymic:
        initials += f"{user.patronymic[0]}."
    return f"{user.last_name or ''} {initials}".strip() or None


def _item_view(item: AutoserviceWarehouseItem) -> AutoserviceWarehouseItemView:
    unit = getattr(item, "unit", None) or "pcs"
    if unit not in ("pcs", "l", "kg"):
        unit = "pcs"
    return AutoserviceWarehouseItemView(
        id=item.id,
        brand=item.brand or "",
        article=item.article or "",
        name=item.name,
        quantity=int(item.quantity or 0),
        reserved_qty=int(item.reserved_qty or 0),
        available_qty=autoservice_item_available_qty(item),
        unit=unit,
        unit_price=item.unit_price,
    )


def _receipt_line_view(
    db: Session,
    row: AutoserviceWarehouseReceipt,
    doc: AutoserviceWarehouseReceiptDoc | None = None,
) -> AutoserviceWarehouseReceiptView:
    item = row.item
    qty = int(row.quantity or 0)
    unit_price = _money(row.unit_price)
    pricing = (
        receipt_line_pricing_context(db, doc=doc, receipt=row)
        if doc is not None
        else {
            "can_edit_price": False,
            "can_edit_unit": False,
            "unit": "pcs",
            "client_unit_price_override": None,
            "markup_percent": None,
            "automatic_client_unit_price": None,
        }
    )
    return AutoserviceWarehouseReceiptView(
        id=row.id,
        item_id=row.item_id,
        brand=item.brand if item else "",
        article=item.article if item else "",
        name=item.name if item else "",
        quantity=qty,
        unit_price=unit_price,
        line_total=_money(unit_price * qty),
        cart_item_type=row.cart_item_type,
        cart_item_id=row.cart_item_id,
        repair_order_id=row.repair_order_id,
        created_at=row.created_at,
        creator_name=_creator_name(row.creator),
        **pricing,
    )


def _doc_total(doc: AutoserviceWarehouseReceiptDoc) -> Decimal:
    total = Decimal("0")
    for line in doc.lines or []:
        total += _money(line.unit_price) * int(line.quantity or 0)
    return _money(total)


def _doc_list_view(doc: AutoserviceWarehouseReceiptDoc) -> AutoserviceWarehouseReceiptDocListView:
    return AutoserviceWarehouseReceiptDocListView(
        id=doc.id,
        number=doc.number,
        doc_date=doc.doc_date,
        supplier_kind=doc.supplier_kind,
        supplier_name=doc.supplier_name,
        total_amount=_doc_total(doc),
        lines_count=len(doc.lines or []),
        repair_order_id=doc.repair_order_id,
        repair_order_number=doc.repair_order.order_number if doc.repair_order else None,
        creator_name=_creator_name(doc.creator),
        created_at=doc.created_at,
    )


def _doc_detail_view(db: Session, doc: AutoserviceWarehouseReceiptDoc) -> AutoserviceWarehouseReceiptDocDetailView:
    lines = [_receipt_line_view(db, line, doc) for line in (doc.lines or [])]
    return AutoserviceWarehouseReceiptDocDetailView(
        id=doc.id,
        number=doc.number,
        doc_date=doc.doc_date,
        supplier_kind=doc.supplier_kind,
        supplier_name=doc.supplier_name,
        total_amount=_doc_total(doc),
        lines_count=len(lines),
        repair_order_id=doc.repair_order_id,
        repair_order_number=doc.repair_order.order_number if doc.repair_order else None,
        creator_name=_creator_name(doc.creator),
        created_at=doc.created_at,
        lines=lines,
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


@router.patch(
    "/autoservice/warehouse/items/{item_id}",
    response_model=AutoserviceWarehouseItemView,
)
def patch_autoservice_warehouse_item(
    item_id: int,
    payload: AutoserviceWarehouseItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    item = update_autoservice_warehouse_item(
        db,
        org_id=org_id,
        item_id=item_id,
        brand=payload.brand,
        article=payload.article,
        name=payload.name,
        unit=payload.unit,
    )
    db.commit()
    return _item_view(item)


@router.get(
    "/autoservice/warehouse/receipts",
    response_model=list[AutoserviceWarehouseReceiptDocListView],
)
def list_autoservice_warehouse_receipts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    rows = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .options(
            joinedload(AutoserviceWarehouseReceiptDoc.lines),
            joinedload(AutoserviceWarehouseReceiptDoc.repair_order),
            joinedload(AutoserviceWarehouseReceiptDoc.creator),
        )
        .filter(AutoserviceWarehouseReceiptDoc.organization_id == org_id)
        .order_by(
            AutoserviceWarehouseReceiptDoc.doc_date.desc(),
            AutoserviceWarehouseReceiptDoc.id.desc(),
        )
        .limit(500)
        .all()
    )
    return [_doc_list_view(row) for row in rows]


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
    "/autoservice/warehouse/receipts/{doc_id}",
    response_model=AutoserviceWarehouseReceiptDocDetailView,
)
def get_autoservice_warehouse_receipt_doc(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    doc = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .options(
            joinedload(AutoserviceWarehouseReceiptDoc.lines).joinedload(
                AutoserviceWarehouseReceipt.item
            ),
            joinedload(AutoserviceWarehouseReceiptDoc.lines).joinedload(
                AutoserviceWarehouseReceipt.creator
            ),
            joinedload(AutoserviceWarehouseReceiptDoc.repair_order),
            joinedload(AutoserviceWarehouseReceiptDoc.creator),
        )
        .filter(
            AutoserviceWarehouseReceiptDoc.id == doc_id,
            AutoserviceWarehouseReceiptDoc.organization_id == org_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ поступления не найден")
    return _doc_detail_view(db, doc)


@router.patch(
    "/autoservice/warehouse/receipts/{doc_id}/lines/{line_id}",
    response_model=AutoserviceWarehouseReceiptDocDetailView,
)
def update_autoservice_warehouse_receipt_line_price(
    doc_id: int,
    line_id: int,
    payload: AutoserviceWarehouseReceiptLinePriceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    fields_set = payload.model_fields_set
    update_manual_receipt_line_prices(
        db,
        org_id=org_id,
        doc_id=doc_id,
        line_id=line_id,
        unit_price=payload.unit_price,
        client_unit_price_override=payload.client_unit_price_override,
        clear_client_unit_price_override=payload.clear_client_unit_price_override,
        unit=payload.unit,
        update_unit_price="unit_price" in fields_set,
        update_client_unit_price_override="client_unit_price_override" in fields_set,
        update_unit="unit" in fields_set,
    )
    db.commit()
    doc = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .options(
            joinedload(AutoserviceWarehouseReceiptDoc.lines).joinedload(
                AutoserviceWarehouseReceipt.item
            ),
            joinedload(AutoserviceWarehouseReceiptDoc.lines).joinedload(
                AutoserviceWarehouseReceipt.creator
            ),
            joinedload(AutoserviceWarehouseReceiptDoc.repair_order),
            joinedload(AutoserviceWarehouseReceiptDoc.creator),
        )
        .filter(
            AutoserviceWarehouseReceiptDoc.id == doc_id,
            AutoserviceWarehouseReceiptDoc.organization_id == org_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Документ поступления не найден")
    return _doc_detail_view(db, doc)


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
    response_model=AutoserviceWarehouseReceiptDocDetailView,
)
def create_autoservice_warehouse_receipt(
    payload: AutoserviceWarehouseManualReceiptIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    qty_dec = Decimal(str(payload.quantity))
    if payload.unit == "pcs":
        if qty_dec != qty_dec.to_integral_value():
            raise HTTPException(
                status_code=400,
                detail="Количество в штуках должно быть целым числом",
            )
        quantity = max(1, int(qty_dec))
    else:
        quantity = max(
            1,
            int(qty_dec.quantize(Decimal("1"), rounding=ROUND_HALF_UP)),
        )
    _item, receipt, _created = receipt_manual_line(
        db,
        org_id=org_id,
        user_id=current_user.id,
        brand=payload.brand,
        article=payload.article,
        name=payload.name,
        quantity=quantity,
        unit_price=payload.unit_price,
        unit=payload.unit,
    )
    db.flush()
    doc_id = receipt.document_id
    db.commit()
    if not doc_id:
        raise HTTPException(status_code=500, detail="Не удалось создать документ поступления")
    doc = (
        db.query(AutoserviceWarehouseReceiptDoc)
        .options(
            joinedload(AutoserviceWarehouseReceiptDoc.lines).joinedload(
                AutoserviceWarehouseReceipt.item
            ),
            joinedload(AutoserviceWarehouseReceiptDoc.lines).joinedload(
                AutoserviceWarehouseReceipt.creator
            ),
            joinedload(AutoserviceWarehouseReceiptDoc.repair_order),
            joinedload(AutoserviceWarehouseReceiptDoc.creator),
        )
        .filter(
            AutoserviceWarehouseReceiptDoc.id == doc_id,
            AutoserviceWarehouseReceiptDoc.organization_id == org_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=500, detail="Документ поступления не найден")
    return _doc_detail_view(db, doc)


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
