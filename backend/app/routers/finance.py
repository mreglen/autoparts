from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.schemas.finance import (
    FinanceInventoryResponse,
    FinanceInventoryRow,
    FinanceSalesResponse,
    FinanceSalesRow,
    FinanceSalesTotals,
    FinanceChannelBreakdown,
    FinanceStockInRow,
    FinanceStockInsResponse,
    FinanceSummaryResponse,
    FinanceWriteoffRow,
    FinanceWriteoffsResponse,
)
from app.services.finance_reports import (
    CHANNEL_ALL,
    CHANNEL_AVITO,
    CHANNEL_MARKETPLACE_USED,
    CHANNEL_WAREHOUSE,
    FinanceFilters,
    build_finance_summary,
    list_finance_inventory,
    list_finance_sales,
    list_finance_stock_ins,
    list_finance_writeoffs,
)
from app.services.finance_xlsx_export import build_finance_workbook_bytes

router = APIRouter(prefix="/finance", tags=["Finance"])

_VALID_CHANNELS = {CHANNEL_ALL, CHANNEL_AVITO, CHANNEL_MARKETPLACE_USED, CHANNEL_WAREHOUSE}


def _has_finance_access(db: Session, user: UserModel) -> bool:
    if user.is_admin or user.is_seller:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == "finance.reports")
    )
    return db.query(q.exists()).scalar() is True


def _require_finance_access(db: Session, user: UserModel) -> None:
    if not _has_finance_access(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к финансовым отчётам",
        )


def _resolve_organization_id(user: UserModel) -> str:
    if not user.organization_id:
        raise HTTPException(status_code=400, detail="У пользователя нет organization_id")
    return user.organization_id


def _parse_filters(
    date_from: date,
    date_to: date,
    as_of_date: date | None = None,
    channel: str = CHANNEL_ALL,
) -> FinanceFilters:
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="date_from не может быть позже date_to")
    ch = (channel or CHANNEL_ALL).strip().lower()
    if ch not in _VALID_CHANNELS:
        raise HTTPException(
            status_code=422,
            detail=f"channel должен быть одним из: {', '.join(sorted(_VALID_CHANNELS))}",
        )
    return FinanceFilters(
        date_from=date_from,
        date_to=date_to,
        as_of_date=as_of_date or date_to,
        channel=ch,
    )


@router.get("/summary", response_model=FinanceSummaryResponse)
def get_finance_summary(
    date_from: date = Query(..., description="Начало периода"),
    date_to: date = Query(..., description="Конец периода"),
    as_of_date: date | None = Query(None, description="Дата среза остатков"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_finance_access(db, current_user)
    org_id = _resolve_organization_id(current_user)
    filters = _parse_filters(date_from, date_to, as_of_date)
    summary = build_finance_summary(db, org_id, filters)
    by_channel = {
        k: FinanceChannelBreakdown(**v) for k, v in summary.get("sales_by_channel", {}).items()
    }
    return FinanceSummaryResponse(**{**summary, "sales_by_channel": by_channel})


@router.get("/sales", response_model=FinanceSalesResponse)
def get_finance_sales(
    date_from: date = Query(...),
    date_to: date = Query(...),
    channel: str = Query(CHANNEL_ALL),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_finance_access(db, current_user)
    org_id = _resolve_organization_id(current_user)
    filters = _parse_filters(date_from, date_to, channel=channel)
    rows, totals = list_finance_sales(db, org_id, filters)
    by_channel = {
        k: FinanceChannelBreakdown(**v) for k, v in totals.get("by_channel", {}).items()
    }
    return FinanceSalesResponse(
        rows=[FinanceSalesRow(**r) for r in rows],
        totals=FinanceSalesTotals(
            count=totals["count"],
            total=totals["total"],
            by_channel=by_channel,
        ),
    )


@router.get("/writeoffs", response_model=FinanceWriteoffsResponse)
def get_finance_writeoffs(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_finance_access(db, current_user)
    org_id = _resolve_organization_id(current_user)
    filters = _parse_filters(date_from, date_to)
    rows, totals = list_finance_writeoffs(db, org_id, filters)
    return FinanceWriteoffsResponse(
        rows=[FinanceWriteoffRow(**r) for r in rows],
        count=totals["count"],
        total_qty=totals["total_qty"],
    )


@router.get("/stock-ins", response_model=FinanceStockInsResponse)
def get_finance_stock_ins(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_finance_access(db, current_user)
    org_id = _resolve_organization_id(current_user)
    filters = _parse_filters(date_from, date_to)
    rows, totals = list_finance_stock_ins(db, org_id, filters)
    return FinanceStockInsResponse(
        rows=[FinanceStockInRow(**r) for r in rows],
        count=totals["count"],
        total_qty=totals["total_qty"],
        total_value=totals["total_value"],
    )


@router.get("/inventory", response_model=FinanceInventoryResponse)
def get_finance_inventory(
    as_of_date: date = Query(..., description="Дата среза остатков"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_finance_access(db, current_user)
    org_id = _resolve_organization_id(current_user)
    filters = FinanceFilters(
        date_from=as_of_date,
        date_to=as_of_date,
        as_of_date=as_of_date,
    )
    rows, totals = list_finance_inventory(db, org_id, filters)
    return FinanceInventoryResponse(
        rows=[FinanceInventoryRow(**r) for r in rows],
        as_of_date=totals["as_of_date"],
        products_count=totals["products_count"],
        total_qty=totals["total_qty"],
        total_value=totals["total_value"],
        note=totals.get("note", ""),
    )


@router.get("/export.xlsx")
def export_finance_xlsx(
    date_from: date = Query(...),
    date_to: date = Query(...),
    as_of_date: date | None = Query(None),
    channel: str = Query(CHANNEL_ALL),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_finance_access(db, current_user)
    org_id = _resolve_organization_id(current_user)
    filters = _parse_filters(date_from, date_to, as_of_date, channel)
    content = build_finance_workbook_bytes(db, org_id, filters)
    filename = f"finance_{filters.date_from.isoformat()}_{filters.date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
