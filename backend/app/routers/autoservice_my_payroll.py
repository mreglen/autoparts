from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.autoservice_finance import AutoserviceMyPayrollResponse
from app.services.autoservice_payroll import compute_employee_monthly_payroll
from app.services.organization_employee_sync import (
    service_employee_id_for_user,
    user_is_service_executor,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_ORDERS_OWN,
    has_autoservice_permission,
    require_autoservice_staff,
)

router = APIRouter(tags=["Autoservice my payroll"])


def _require_my_payroll_access(db: Session, user: User) -> tuple[str, int]:
    org_id = require_autoservice_staff(db, user)
    if user.is_admin or user.is_director:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Зарплаты сотрудников доступны в разделе «Отчёты»",
        )
    if not user_is_service_executor(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Раздел доступен исполнителям работ",
        )
    if not has_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_ORDERS_OWN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к разделу «Зарплата»",
        )
    employee_id = service_employee_id_for_user(db, org_id, user.id)
    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Карточка исполнителя не привязана к вашему аккаунту",
        )
    return org_id, employee_id


@router.get("/autoservice/my/payroll", response_model=AutoserviceMyPayrollResponse)
def get_my_payroll(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id, employee_id = _require_my_payroll_access(db, current_user)
    data = compute_employee_monthly_payroll(db, org_id, employee_id, year, month)
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    return AutoserviceMyPayrollResponse.model_validate(data)
