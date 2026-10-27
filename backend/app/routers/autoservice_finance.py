from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_payment import AutoservicePayment
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_finance import (
    AutoserviceFinanceReceiptRow,
    AutoserviceFinanceReceiptsResponse,
    AutoserviceOrderEconomicsResponse,
    AutoserviceOrderEconomicsRow,
    AutoserviceOrderEconomicsSummary,
    AutoservicePaymentUpdate,
    AutoservicePayrollReportEmployeeRow,
    AutoservicePayrollReportResponse,
    RosskoSalesReportResponse,
    RosskoSalesReportRow,
    RosskoSalesReportSummary,
)
from app.schemas.autoservice_warehouse import (
    WarehouseStockReportResponse,
    WarehouseStockReportRow,
    WarehouseStockReportSummary,
)
from app.services.autoservice_finance_receipts_xlsx import build_finance_receipts_workbook_bytes
from app.services.autoservice_audit import log_autoservice, repair_order_label
from app.services.autoservice_order_economics import (
    OrderEconomicsFilters,
    build_order_economics_report,
)
from app.services.autoservice_order_economics_xlsx import build_order_economics_workbook_bytes
from app.services.autoservice_warehouse_stock_report import WarehouseStockReportFilters, build_warehouse_stock_report
from app.services.autoservice_warehouse_stock_report_xlsx import build_warehouse_stock_workbook_bytes
from app.services.autoservice_payment_service import (
    delete_autoservice_payment,
    list_finance_receipts,
    update_autoservice_payment,
)
from app.services.autoservice_payroll import compute_org_monthly_payroll
from app.services.autoservice_payroll_report_xlsx import build_payroll_report_workbook_bytes
from app.services.autoservice_rossko_sales_report import RosskoSalesReportFilters, build_rossko_sales_report
from app.services.autoservice_rossko_sales_report_xlsx import build_rossko_sales_workbook_bytes
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_FINANCE,
    AUTOSERVICE_PERMISSION_ORDERS,
    AUTOSERVICE_PERMISSION_REPORTS,
    require_any_autoservice_permission,
    require_autoservice_director,
    require_autoservice_permission,
    require_rossko_sales_report_access,
)

router = APIRouter(tags=["Autoservice finance"])


def _log_report_export(
    db: Session,
    current_user: User,
    org_id: str,
    report: str,
    period: str,
) -> None:
    log_autoservice(
        db,
        event_type="autoservice_report_exported",
        summary=f"Экспорт отчёта «{report}» ({period})",
        user=current_user,
        organization_id=org_id,
        entity_type="autoservice_report",
        details={"report": report, "period": period},
    )


@router.get(
    "/autoservice/finance/receipts",
    response_model=AutoserviceFinanceReceiptsResponse,
)
def get_autoservice_finance_receipts(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_FINANCE,
        AUTOSERVICE_PERMISSION_REPORTS,
    )
    return list_finance_receipts(db, org_id=org_id, date_from=date_from, date_to=date_to)


@router.patch(
    "/autoservice/finance/receipts/{payment_id}",
    response_model=AutoserviceFinanceReceiptRow,
)
def patch_autoservice_finance_receipt(
    payment_id: int,
    payload: AutoservicePaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_FINANCE,
        AUTOSERVICE_PERMISSION_ORDERS,
    )
    row = update_autoservice_payment(
        db,
        org_id=org_id,
        payment_id=payment_id,
        paid_at=payload.paid_at,
        amount=payload.amount,
        method=payload.method,
    )
    db.commit()
    log_autoservice(
        db,
        event_type="finance_payment_updated",
        summary=(
            f"Изменено поступление №{row.sequential_number}: {row.method} {row.amount} ₽ "
            f"от {row.paid_at} по заказ-наряду №{row.repair_order_number}"
        ),
        user=current_user,
        organization_id=org_id,
        entity_type="autoservice_payment",
        entity_id=row.id,
        details={
            "paid_at": str(payload.paid_at) if payload.paid_at else None,
            "amount": str(payload.amount) if payload.amount is not None else None,
            "method": payload.method,
        },
    )
    return row


@router.delete(
    "/autoservice/finance/receipts/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_autoservice_finance_receipt(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_FINANCE,
        AUTOSERVICE_PERMISSION_ORDERS,
    )
    payment = (
        db.query(AutoservicePayment)
        .options(joinedload(AutoservicePayment.order).joinedload(RepairOrder.client))
        .filter(
            AutoservicePayment.id == payment_id,
            AutoservicePayment.organization_id == org_id,
        )
        .first()
    )
    label = (
        f"№{payment.sequential_number} ({payment.amount} ₽)"
        if payment
        else f"id {payment_id}"
    )
    order_label = repair_order_label(payment.order) if payment and payment.order else ""
    delete_autoservice_payment(
        db, org_id=org_id, payment_id=payment_id, user_id=current_user.id
    )
    db.commit()
    log_autoservice(
        db,
        event_type="finance_payment_cancelled",
        summary=f"Отменено поступление {label}"
        + (f" по заказ-наряду {order_label}" if order_label else ""),
        user=current_user,
        organization_id=org_id,
        entity_type="autoservice_payment",
        entity_id=payment_id,
    )


@router.get("/autoservice/finance/receipts.xlsx")
def export_autoservice_finance_receipts_xlsx(
    date_from: date = Query(...),
    date_to: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_any_autoservice_permission(
        db,
        current_user,
        AUTOSERVICE_PERMISSION_FINANCE,
        AUTOSERVICE_PERMISSION_REPORTS,
    )
    content = build_finance_receipts_workbook_bytes(db, org_id, date_from, date_to)
    _log_report_export(
        db, current_user, org_id, "Поступления", f"{date_from.isoformat()}—{date_to.isoformat()}"
    )
    filename = f"autoservice_payments_{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/autoservice/reports/payroll",
    response_model=AutoservicePayrollReportResponse,
)
def get_autoservice_payroll_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    data = compute_org_monthly_payroll(db, org_id, year, month)
    return AutoservicePayrollReportResponse(
        year=data["year"],
        month=data["month"],
        total=data["total"],
        employees=[AutoservicePayrollReportEmployeeRow.model_validate(row) for row in data["employees"]],
    )


@router.get("/autoservice/reports/payroll.xlsx")
def export_autoservice_payroll_report_xlsx(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    content = build_payroll_report_workbook_bytes(db, org_id, year, month)
    _log_report_export(db, current_user, org_id, "Зарплата", f"{year}-{month:02d}")
    filename = f"payroll_{year}_{month:02d}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/autoservice/reports/order-economics",
    response_model=AutoserviceOrderEconomicsResponse,
)
def get_autoservice_order_economics_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    status: str = Query("all"),
    payment: str = Query("all"),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_REPORTS)
    filters = OrderEconomicsFilters(
        date_from=date_from,
        date_to=date_to,
        status=status,
        payment=payment,
        q=q,
    )
    data = build_order_economics_report(db, org_id, filters)
    return AutoserviceOrderEconomicsResponse(
        date_from=data["date_from"],
        date_to=data["date_to"],
        summary=AutoserviceOrderEconomicsSummary.model_validate(data["summary"]),
        items=[AutoserviceOrderEconomicsRow.model_validate(row) for row in data["items"]],
    )


@router.get("/autoservice/reports/order-economics.xlsx")
def export_autoservice_order_economics_xlsx(
    date_from: date = Query(...),
    date_to: date = Query(...),
    status: str = Query("all"),
    payment: str = Query("all"),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_REPORTS)
    filters = OrderEconomicsFilters(
        date_from=date_from,
        date_to=date_to,
        status=status,
        payment=payment,
        q=q,
    )
    content = build_order_economics_workbook_bytes(db, org_id, filters)
    _log_report_export(
        db,
        current_user,
        org_id,
        "Экономика заказ-нарядов",
        f"{date_from.isoformat()}—{date_to.isoformat()}",
    )
    filename = f"order_economics_{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/autoservice/reports/warehouse-stock",
    response_model=WarehouseStockReportResponse,
)
def get_autoservice_warehouse_stock_report(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    q: str | None = Query(None),
    hide_zero: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_REPORTS)
    filters = WarehouseStockReportFilters(
        year=year,
        month=month,
        q=q,
        hide_zero=hide_zero,
    )
    data = build_warehouse_stock_report(db, org_id, filters)
    return WarehouseStockReportResponse(
        year=data["year"],
        month=data["month"],
        as_of=data["as_of"],
        is_current_month=data["is_current_month"],
        summary=WarehouseStockReportSummary.model_validate(data["summary"]),
        items=[WarehouseStockReportRow.model_validate(row) for row in data["items"]],
    )


@router.get("/autoservice/reports/warehouse-stock.xlsx")
def export_autoservice_warehouse_stock_xlsx(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    q: str | None = Query(None),
    hide_zero: bool = Query(True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_REPORTS)
    filters = WarehouseStockReportFilters(
        year=year,
        month=month,
        q=q,
        hide_zero=hide_zero,
    )
    content = build_warehouse_stock_workbook_bytes(db, org_id, filters)
    _log_report_export(db, current_user, org_id, "Остатки склада", f"{year}-{month:02d}")
    filename = f"warehouse_stock_{year}_{month:02d}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/autoservice/reports/rossko-sales",
    response_model=RosskoSalesReportResponse,
)
def get_autoservice_rossko_sales_report(
    date_from: date = Query(...),
    date_to: date = Query(...),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_rossko_sales_report_access(db, current_user)
    filters = RosskoSalesReportFilters(date_from=date_from, date_to=date_to, q=q)
    data = build_rossko_sales_report(db, org_id, filters)
    return RosskoSalesReportResponse(
        date_from=data["date_from"],
        date_to=data["date_to"],
        summary=RosskoSalesReportSummary.model_validate(data["summary"]),
        items=[RosskoSalesReportRow.model_validate(row) for row in data["items"]],
    )


@router.get("/autoservice/reports/rossko-sales.xlsx")
def export_autoservice_rossko_sales_xlsx(
    date_from: date = Query(...),
    date_to: date = Query(...),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_rossko_sales_report_access(db, current_user)
    filters = RosskoSalesReportFilters(date_from=date_from, date_to=date_to, q=q)
    content = build_rossko_sales_workbook_bytes(db, org_id, filters)
    _log_report_export(
        db,
        current_user,
        org_id,
        "Продажи Rossko",
        f"{date_from.isoformat()}—{date_to.isoformat()}",
    )
    filename = f"rossko_sales_{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
