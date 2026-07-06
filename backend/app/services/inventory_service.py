from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models.inventory_adjustment_line import InventoryAdjustmentLine
from app.models.inventory_count_line import InventoryCountLine
from app.models.inventory_session import InventorySession
from app.models.product import Product
from app.models.product_storage_cell import ProductStorageCell
from app.models.stock_in import StockIn
from app.models.storage_cell import StorageCell
from app.models.storage_location import StorageLocation
from app.models.user import User
from app.schemas.inventory import (
    InventoryAdjustmentReport,
    InventoryAdjustmentReportRow,
    InventoryCompleteResponse,
    InventoryCountLineResponse,
    InventorySessionCreate,
    InventorySessionListItem,
    InventorySessionResponse,
)
from app.services.audit_service import log_audit
from app.services.stock_sale_fulfillment import (
    FulfillStockOutRequest,
    StockOutSourceKind,
    fulfill_stock_out,
)
from app.services.yandex_feed_sync_service import mark_yandex_feed_dirty
from app.utils.public_catalog_cache import (
    invalidate_public_catalog_cache,
    invalidate_public_product_detail,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _json_load_ids(raw: Optional[str]) -> list[int]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [int(x) for x in data]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _json_dump_ids(ids: list[int]) -> Optional[str]:
    if not ids:
        return None
    return json.dumps(ids)


def _session_query(db: Session):
    return db.query(InventorySession).options(
        joinedload(InventorySession.storage_location),
        joinedload(InventorySession.count_lines).joinedload(InventoryCountLine.product),
    )


def _line_counts(session: InventorySession) -> tuple[int, int, int]:
    lines = session.count_lines or []
    total = len(lines)
    counted = sum(1 for line in lines if line.line_status in ("counted", "skipped"))
    pending = total - counted
    return total, counted, pending


def _serialize_line(line: InventoryCountLine) -> InventoryCountLineResponse:
    product = line.product
    return InventoryCountLineResponse(
        id=line.id,
        product_id=line.product_id,
        storage_location_id=line.storage_location_id,
        storage_cell_id=line.storage_cell_id,
        expected_qty=int(line.expected_qty or 0),
        counted_qty=line.counted_qty,
        line_status=line.line_status,
        product_article=product.article if product else None,
        product_name=product.name if product else None,
        product_brand=product.brand if product else None,
    )


def _serialize_session(session: InventorySession, *, include_lines: bool = True) -> InventorySessionResponse:
    total, counted, pending = _line_counts(session)
    lines = [_serialize_line(line) for line in (session.count_lines or [])] if include_lines else []
    storage = session.storage_location
    return InventorySessionResponse(
        id=session.id,
        organization_id=session.organization_id,
        storage_location_id=session.storage_location_id,
        storage_location_address=storage.address if storage else None,
        status=session.status,
        scope_type=session.scope_type,
        scope_cell_ids=_json_load_ids(session.scope_cell_ids_json),
        scope_product_ids=_json_load_ids(session.scope_product_ids_json),
        title=session.title,
        notes=session.notes,
        created_by=session.created_by,
        completed_by=session.completed_by,
        started_at=session.started_at,
        completed_at=session.completed_at,
        created_at=session.created_at,
        updated_at=session.updated_at,
        count_lines=lines,
        lines_total=total,
        lines_counted=counted,
        lines_pending=pending,
    )


def _get_session_or_404(db: Session, organization_id: str, session_id: int) -> InventorySession:
    session = _session_query(db).filter(
        InventorySession.id == session_id,
        InventorySession.organization_id == organization_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Сессия инвентаризации не найдена")
    return session


def _ensure_session_mutable(session: InventorySession) -> None:
    if session.status in ("completed", "cancelled"):
        raise HTTPException(status_code=400, detail="Сессия уже завершена или отменена")


def _resolve_products_for_scope(
    db: Session,
    *,
    organization_id: str,
    storage_location_id: int,
    scope_type: str,
    scope_cell_ids: list[int],
    scope_product_ids: list[int],
) -> list[Product]:
    base_query = db.query(Product).filter(
        Product.organization_id == organization_id,
        Product.storage_location_id == storage_location_id,
    )

    if scope_type == "products":
        if not scope_product_ids:
            raise HTTPException(status_code=400, detail="Выберите товары для инвентаризации")
        return base_query.filter(Product.id.in_(scope_product_ids)).all()

    if scope_type == "cells":
        if not scope_cell_ids:
            raise HTTPException(status_code=400, detail="Выберите ячейки для инвентаризации")
        cell_rows = (
            db.query(StorageCell)
            .filter(
                StorageCell.id.in_(scope_cell_ids),
                StorageCell.storage_location_id == storage_location_id,
            )
            .all()
        )
        if len(cell_rows) != len(set(scope_cell_ids)):
            raise HTTPException(status_code=400, detail="Некорректный список ячеек")
        product_ids = {
            row.product_id
            for row in db.query(ProductStorageCell)
            .join(StorageCell, StorageCell.id == ProductStorageCell.storage_cell_id)
            .filter(
                ProductStorageCell.storage_cell_id.in_(scope_cell_ids),
                StorageCell.storage_location_id == storage_location_id,
            )
            .all()
        }
        if not product_ids:
            return []
        return base_query.filter(Product.id.in_(product_ids)).all()

    return base_query.all()


def create_inventory_session(
    db: Session,
    *,
    organization_id: str,
    user: User,
    payload: InventorySessionCreate,
) -> InventorySessionResponse:
    storage = (
        db.query(StorageLocation)
        .filter(
            StorageLocation.id == payload.storage_location_id,
            StorageLocation.organization_id == organization_id,
        )
        .first()
    )
    if not storage:
        raise HTTPException(status_code=404, detail="Склад не найден")

    products = _resolve_products_for_scope(
        db,
        organization_id=organization_id,
        storage_location_id=payload.storage_location_id,
        scope_type=payload.scope_type,
        scope_cell_ids=payload.scope_cell_ids,
        scope_product_ids=payload.scope_product_ids,
    )
    if not products:
        raise HTTPException(status_code=400, detail="Нет товаров для инвентаризации по выбранному охвату")

    now = _utcnow()
    session = InventorySession(
        organization_id=organization_id,
        storage_location_id=payload.storage_location_id,
        status="counting",
        scope_type=payload.scope_type,
        scope_cell_ids_json=_json_dump_ids(payload.scope_cell_ids),
        scope_product_ids_json=_json_dump_ids(payload.scope_product_ids),
        title=payload.title,
        notes=payload.notes,
        created_by=user.id,
        started_at=now,
    )
    db.add(session)
    db.flush()

    for product in products:
        db.add(
            InventoryCountLine(
                session_id=session.id,
                product_id=product.id,
                storage_location_id=payload.storage_location_id,
                expected_qty=int(product.quantity or 0),
                line_status="pending",
            )
        )

    db.commit()
    db.refresh(session)
    session = _get_session_or_404(db, organization_id, session.id)

    log_audit(
        db,
        event_type="inventory_session_created",
        category="warehouse",
        summary=f"Инвентаризация #{session.id}: {len(products)} поз.",
        user=user,
        organization_id=organization_id,
        details={
            "session_id": session.id,
            "storage_location_id": session.storage_location_id,
            "scope_type": session.scope_type,
            "lines_count": len(products),
        },
        entity_type="inventory_session",
        entity_id=session.id,
    )

    return _serialize_session(session)


def list_inventory_sessions(db: Session, organization_id: str) -> list[InventorySessionListItem]:
    sessions = (
        db.query(InventorySession)
        .options(joinedload(InventorySession.storage_location), joinedload(InventorySession.count_lines))
        .filter(InventorySession.organization_id == organization_id)
        .order_by(InventorySession.created_at.desc())
        .all()
    )
    items: list[InventorySessionListItem] = []
    for session in sessions:
        total, counted, _ = _line_counts(session)
        storage = session.storage_location
        items.append(
            InventorySessionListItem(
                id=session.id,
                storage_location_id=session.storage_location_id,
                storage_location_address=storage.address if storage else None,
                status=session.status,
                scope_type=session.scope_type,
                title=session.title,
                created_at=session.created_at,
                completed_at=session.completed_at,
                lines_total=total,
                lines_counted=counted,
            )
        )
    return items


def get_inventory_session(db: Session, organization_id: str, session_id: int) -> InventorySessionResponse:
    session = _get_session_or_404(db, organization_id, session_id)
    return _serialize_session(session)


def update_inventory_count_line(
    db: Session,
    *,
    organization_id: str,
    session_id: int,
    line_id: int,
    counted_qty: Optional[int],
    line_status: Optional[str],
) -> InventorySessionResponse:
    session = _get_session_or_404(db, organization_id, session_id)
    _ensure_session_mutable(session)

    line = next((row for row in session.count_lines if row.id == line_id), None)
    if not line:
        raise HTTPException(status_code=404, detail="Строка подсчёта не найдена")

    if line_status == "skipped":
        line.line_status = "skipped"
        line.counted_qty = line.expected_qty
    else:
        if counted_qty is None:
            raise HTTPException(status_code=400, detail="Укажите фактическое количество")
        if counted_qty < 0:
            raise HTTPException(status_code=400, detail="Количество не может быть отрицательным")
        line.counted_qty = counted_qty
        line.line_status = "counted"

    db.commit()
    session = _get_session_or_404(db, organization_id, session_id)
    return _serialize_session(session)


def bulk_update_inventory_count_lines(
    db: Session,
    *,
    organization_id: str,
    session_id: int,
    updates: list[dict],
) -> InventorySessionResponse:
    session = _get_session_or_404(db, organization_id, session_id)
    _ensure_session_mutable(session)
    by_id = {line.id: line for line in session.count_lines}

    for item in updates:
        line = by_id.get(item["line_id"])
        if not line:
            continue
        if item.get("line_status") == "skipped":
            line.line_status = "skipped"
            line.counted_qty = line.expected_qty
            continue
        if item.get("counted_qty") is not None:
            counted_qty = int(item["counted_qty"])
            if counted_qty < 0:
                raise HTTPException(status_code=400, detail="Количество не может быть отрицательным")
            line.counted_qty = counted_qty
            line.line_status = "counted"

    db.commit()
    session = _get_session_or_404(db, organization_id, session_id)
    return _serialize_session(session)


def _build_report_rows(session: InventorySession) -> list[InventoryAdjustmentReportRow]:
    rows: list[InventoryAdjustmentReportRow] = []
    for line in session.count_lines or []:
        if line.line_status == "pending":
            continue
        counted_qty = int(line.counted_qty if line.counted_qty is not None else line.expected_qty)
        expected_qty = int(line.expected_qty or 0)
        delta_qty = counted_qty - expected_qty
        if delta_qty > 0:
            kind = "surplus"
        elif delta_qty < 0:
            kind = "shortage"
        else:
            kind = "match"
        product = line.product
        rows.append(
            InventoryAdjustmentReportRow(
                line_id=line.id,
                product_id=line.product_id,
                product_article=product.article if product else None,
                product_name=product.name if product else None,
                expected_qty=expected_qty,
                counted_qty=counted_qty,
                delta_qty=delta_qty,
                adjustment_kind=kind,
            )
        )
    return rows


def get_inventory_adjustment_report(
    db: Session,
    organization_id: str,
    session_id: int,
) -> InventoryAdjustmentReport:
    session = _get_session_or_404(db, organization_id, session_id)
    rows = _build_report_rows(session)
    total, counted, pending = _line_counts(session)

    surplus_count = sum(1 for row in rows if row.adjustment_kind == "surplus")
    shortage_count = sum(1 for row in rows if row.adjustment_kind == "shortage")
    match_count = sum(1 for row in rows if row.adjustment_kind == "match")
    surplus_qty = sum(row.delta_qty for row in rows if row.delta_qty > 0)
    shortage_qty = sum(abs(row.delta_qty) for row in rows if row.delta_qty < 0)

    can_complete = pending == 0 and session.status == "counting"
    blocking_reason = None
    if session.status != "counting":
        blocking_reason = "Сессия не в статусе подсчёта"
    elif pending > 0:
        blocking_reason = f"Осталось неподсчитанных позиций: {pending}"

    return InventoryAdjustmentReport(
        session_id=session.id,
        status=session.status,
        rows=rows,
        totals={
            "lines_total": total,
            "lines_counted": counted,
            "lines_pending": pending,
            "surplus_count": surplus_count,
            "shortage_count": shortage_count,
            "match_count": match_count,
            "surplus_qty": surplus_qty,
            "shortage_qty": shortage_qty,
        },
        can_complete=can_complete,
        blocking_reason=blocking_reason,
    )


def complete_inventory_session(
    db: Session,
    *,
    organization_id: str,
    user: User,
    session_id: int,
    apply_adjustments: bool,
    notes: Optional[str] = None,
) -> InventoryCompleteResponse:
    session = _get_session_or_404(db, organization_id, session_id)
    report = get_inventory_adjustment_report(db, organization_id, session_id)
    if not report.can_complete:
        raise HTTPException(
            status_code=400,
            detail=report.blocking_reason or "Нельзя завершить инвентаризацию",
        )

    stock_ins_created = 0
    stock_outs_created = 0
    adjustments_applied = 0
    matches = 0
    movement_date = date.today()

    if apply_adjustments:
        for row in report.rows:
            if row.adjustment_kind == "match":
                matches += 1
                db.add(
                    InventoryAdjustmentLine(
                        session_id=session.id,
                        product_id=row.product_id,
                        storage_location_id=session.storage_location_id,
                        expected_qty=row.expected_qty,
                        counted_qty=row.counted_qty,
                        delta_qty=0,
                        adjustment_kind="match",
                        applied_at=_utcnow(),
                    )
                )
                continue

            product = (
                db.query(Product)
                .filter(
                    Product.id == row.product_id,
                    Product.organization_id == organization_id,
                )
                .first()
            )
            if not product:
                continue

            stock_in_id = None
            stock_out_id = None

            if row.adjustment_kind == "surplus" and row.delta_qty > 0:
                stock_in = StockIn(
                    organization_id=organization_id,
                    product_id=row.product_id,
                    storage_location_id=session.storage_location_id,
                    quantity=row.delta_qty,
                    sale_price=product.price or 0,
                    created_by=user.id,
                    created_at=movement_date,
                )
                db.add(stock_in)
                db.flush()
                stock_in_id = stock_in.id
                product.quantity = int(product.quantity or 0) + row.delta_qty
                stock_ins_created += 1
                if product.is_new is False:
                    mark_yandex_feed_dirty(db, "inventory_adjustment_surplus")
                    invalidate_public_catalog_cache()
                    invalidate_public_product_detail(product.id)

            elif row.adjustment_kind == "shortage" and row.delta_qty < 0:
                qty = abs(row.delta_qty)
                if int(product.quantity or 0) < qty:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Недостаточно остатка для списания: "
                            f"{product.article or product.name} (нужно {qty}, есть {product.quantity or 0})"
                        ),
                    )
                result = fulfill_stock_out(
                    db,
                    FulfillStockOutRequest(
                        organization_id=organization_id,
                        product_id=row.product_id,
                        quantity=qty,
                        sale_price=0,
                        storage_location_id=session.storage_location_id,
                        movement_date=movement_date,
                        source_kind=StockOutSourceKind.WRITEOFF,
                        user_id=user.id,
                        reason=f"Инвентаризация #{session.id}",
                    ),
                    commit=False,
                )
                stock_out_id = result.stock_out.id
                stock_outs_created += 1
                if product.is_new is False:
                    mark_yandex_feed_dirty(db, "inventory_adjustment_shortage")

            db.add(
                InventoryAdjustmentLine(
                    session_id=session.id,
                    product_id=row.product_id,
                    storage_location_id=session.storage_location_id,
                    expected_qty=row.expected_qty,
                    counted_qty=row.counted_qty,
                    delta_qty=row.delta_qty,
                    adjustment_kind=row.adjustment_kind,
                    stock_in_id=stock_in_id,
                    stock_out_id=stock_out_id,
                    applied_at=_utcnow(),
                )
            )
            adjustments_applied += 1
    else:
        matches = sum(1 for row in report.rows if row.adjustment_kind == "match")

    session.status = "completed"
    session.completed_by = user.id
    session.completed_at = _utcnow()
    if notes:
        session.notes = notes

    db.commit()

    log_audit(
        db,
        event_type="inventory_session_completed",
        category="warehouse",
        summary=(
            f"Инвентаризация #{session.id} завершена"
            + (f", корректировок: {adjustments_applied}" if apply_adjustments else " без корректировок")
        ),
        user=user,
        organization_id=organization_id,
        details={
            "session_id": session.id,
            "apply_adjustments": apply_adjustments,
            "adjustments_applied": adjustments_applied,
            "stock_ins_created": stock_ins_created,
            "stock_outs_created": stock_outs_created,
            "matches": matches,
        },
        entity_type="inventory_session",
        entity_id=session.id,
    )

    return InventoryCompleteResponse(
        session_id=session.id,
        status="completed",
        adjustments_applied=adjustments_applied,
        stock_ins_created=stock_ins_created,
        stock_outs_created=stock_outs_created,
        matches=matches,
    )
