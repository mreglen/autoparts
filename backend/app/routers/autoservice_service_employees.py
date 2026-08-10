from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_service_employee import AutoserviceServiceEmployee
from app.models.user import User
from app.schemas.autoservice_service_employee import (
    AutoserviceEmployeePayrollStats,
    AutoserviceServiceEmployeeBulkPercent,
    AutoserviceServiceEmployeeCreate,
    AutoserviceServiceEmployeeUpdate,
    AutoserviceServiceEmployeeView,
)
from app.services.autoservice_payroll import compute_employee_stats
from app.utils.autoservice_access import require_autoservice_director, require_autoservice_staff

router = APIRouter(tags=["Autoservice service employees"])


def _get_org_employee_or_404(db: Session, org_id: str, employee_id: int) -> AutoserviceServiceEmployee:
    row = (
        db.query(AutoserviceServiceEmployee)
        .filter(
            AutoserviceServiceEmployee.id == employee_id,
            AutoserviceServiceEmployee.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден")
    return row


@router.get("/autoservice/service-employees", response_model=list[AutoserviceServiceEmployeeView])
def list_service_employees(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    query = db.query(AutoserviceServiceEmployee).filter(
        AutoserviceServiceEmployee.organization_id == org_id,
    )
    if not include_inactive:
        query = query.filter(AutoserviceServiceEmployee.is_active.is_(True))
    rows = query.order_by(AutoserviceServiceEmployee.name.asc()).all()
    return [AutoserviceServiceEmployeeView.model_validate(row) for row in rows]


@router.post(
    "/autoservice/service-employees",
    response_model=AutoserviceServiceEmployeeView,
    status_code=status.HTTP_201_CREATED,
)
def create_service_employee(
    payload: AutoserviceServiceEmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = AutoserviceServiceEmployee(
        organization_id=org_id,
        name=payload.name.strip(),
        phone=(payload.phone or "").strip() or None,
        position=(payload.position or "").strip() or None,
        salary_type=payload.salary_type,
        salary_amount=payload.salary_amount,
        work_percent=payload.work_percent,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return AutoserviceServiceEmployeeView.model_validate(row)


@router.patch(
    "/autoservice/service-employees/{employee_id}",
    response_model=AutoserviceServiceEmployeeView,
)
def update_service_employee(
    employee_id: int,
    payload: AutoserviceServiceEmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_employee_or_404(db, org_id, employee_id)
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Имя пустое")
        row.name = name
    if payload.phone is not None:
        row.phone = payload.phone.strip() or None
    if payload.position is not None:
        row.position = payload.position.strip() or None
    if payload.salary_type is not None:
        row.salary_type = payload.salary_type
    if payload.salary_amount is not None:
        row.salary_amount = payload.salary_amount
    if payload.work_percent is not None:
        row.work_percent = payload.work_percent
    if payload.is_active is not None:
        row.is_active = payload.is_active
    db.commit()
    db.refresh(row)
    return AutoserviceServiceEmployeeView.model_validate(row)


@router.post("/autoservice/service-employees/bulk-percent", status_code=status.HTTP_204_NO_CONTENT)
def bulk_update_work_percent(
    payload: AutoserviceServiceEmployeeBulkPercent,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    db.query(AutoserviceServiceEmployee).filter(
        AutoserviceServiceEmployee.organization_id == org_id,
        AutoserviceServiceEmployee.is_active.is_(True),
    ).update({"work_percent": payload.work_percent}, synchronize_session=False)
    db.commit()


@router.get(
    "/autoservice/service-employees/{employee_id}/stats",
    response_model=AutoserviceEmployeePayrollStats,
)
def employee_payroll_stats(
    employee_id: int,
    period: str = Query("month", pattern="^(day|week|month|year)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_org_employee_or_404(db, org_id, employee_id)
    data = compute_employee_stats(db, org_id, row, period)
    return AutoserviceEmployeePayrollStats.model_validate(data)
