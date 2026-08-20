from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.autoservice_finance import (
    AutoserviceFinanceReceiptRow,
    AutoserviceFinanceReceiptsResponse,
    AutoserviceOrderEconomicsResponse,
    AutoserviceOrderEconomicsRow,
    AutoserviceOrderEconomicsSummary,
    AutoservicePaymentDateUpdate,
    AutoservicePayrollReportEmployeeRow,
    AutoservicePayrollReportResponse,
)
from app.services.autoservice_order_economics import (
    OrderEconomicsFilters,
    build_order_economics_report,
)
from app.services.autoservice_order_economics_xlsx import build_order_economics_workbook_bytes
from app.services.autoservice_payment_service import (
    list_finance_receipts,
    update_autoservice_payment_date,
)
from app.services.autoservice_payroll import compute_org_monthly_payroll
from app.utils.autoservice_access import require_autoservice_director, require_autoservice_staff

router = APIRouter(tags=["Autoservice finance"])


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
    org_id = require_autoservice_staff(db, current_user)
    return list_finance_receipts(db, org_id=org_id, date_from=date_from, date_to=date_to)


@router.patch(
    "/autoservice/finance/receipts/{payment_id}",
    response_model=AutoserviceFinanceReceiptRow,
)
def patch_autoservice_finance_receipt_date(
    payment_id: int,
    payload: AutoservicePaymentDateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = update_autoservice_payment_date(
        db,
        org_id=org_id,
        payment_id=payment_id,
        paid_at=payload.paid_at,
    )
    db.commit()
    return row


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
    org_id = require_autoservice_staff(db, current_user)
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
    org_id = require_autoservice_staff(db, current_user)
    filters = OrderEconomicsFilters(
        date_from=date_from,
        date_to=date_to,
        status=status,
        payment=payment,
        q=q,
    )
    content = build_order_economics_workbook_bytes(db, org_id, filters)
    filename = f"order_economics_{date_from.isoformat()}_{date_to.isoformat()}.xlsx"
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
