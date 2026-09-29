from __future__ import annotations

from datetime import datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, joinedload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.autoservice_payment import AutoservicePayment
from app.models.inspection_booking import InspectionBooking
from app.models.repair_order import RepairOrder
from app.models.user import User
from app.schemas.autoservice_dashboard import (
    AutoserviceDashboardPayrollBlock,
    AutoserviceDashboardSummary,
)
from app.schemas.repair_order import ACTIVE_STATUSES, REVIEW_STATUSES
from app.services.autoservice_client_stats import client_stats_map
from app.services.autoservice_payroll import compute_employee_monthly_payroll
from app.services.autoservice_planner_items import (
    planner_inspection_item,
    planner_order_item,
)
from app.services.organization_employee_sync import (
    service_employee_id_for_user,
    user_is_service_executor,
)
from app.routers.autoservice_repair_orders import _own_orders_visibility_clause
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_CLIENTS,
    AUTOSERVICE_PERMISSION_FINANCE,
    AUTOSERVICE_PERMISSION_INSPECTIONS,
    AUTOSERVICE_PERMISSION_ORDERS_OWN,
    has_autoservice_permission,
    orders_access_level,
    require_autoservice_staff,
)

router = APIRouter(tags=["Autoservice dashboard"])


def _payroll_month_block(db: Session, org_id: str, user: User):
    if user.is_admin or user.is_director:
        return None
    if not has_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_ORDERS_OWN):
        return None
    if not user_is_service_executor(db, user):
        return None
    employee_id = service_employee_id_for_user(db, org_id, user.id)
    if not employee_id:
        return None
    today = datetime.utcnow()
    data = compute_employee_monthly_payroll(db, org_id, employee_id, today.year, today.month)
    if not data:
        return None
    return AutoserviceDashboardPayrollBlock(
        year=today.year,
        month=today.month,
        total=data.get("total", 0),
        completed_orders=data.get("completed_orders", 0),
    )


def _today_items(db: Session, org_id: str, user: User, level: str | None) -> list:
    now = datetime.utcnow()
    range_start = datetime.combine(now.date(), time.min)
    range_end = range_start + timedelta(days=1)
    items = []

    if level:
        orders_query = (
            db.query(RepairOrder)
            .options(
                joinedload(RepairOrder.client),
                joinedload(RepairOrder.vehicle),
                joinedload(RepairOrder.work_zone),
            )
            .filter(
                RepairOrder.organization_id == org_id,
                RepairOrder.scheduled_at < range_end,
                or_(
                    RepairOrder.scheduled_end_at > range_start,
                    RepairOrder.status == "in_progress",
                    and_(
                        RepairOrder.scheduled_end_at.is_(None),
                        RepairOrder.scheduled_at >= range_start,
                    ),
                ),
                RepairOrder.status.notin_(("cancelled",) + REVIEW_STATUSES),
            )
        )
        if level == "own":
            orders_query = orders_query.filter(
                _own_orders_visibility_clause(db, org_id, user)
            )
        orders = orders_query.order_by(
            RepairOrder.scheduled_at.asc(), RepairOrder.id.asc()
        ).all()
        items.extend(planner_order_item(row) for row in orders)

    if has_autoservice_permission(db, user, AUTOSERVICE_PERMISSION_INSPECTIONS):
        bookings = (
            db.query(InspectionBooking)
            .options(
                joinedload(InspectionBooking.vehicle),
                joinedload(InspectionBooking.work_zone),
            )
            .filter(
                InspectionBooking.organization_id == org_id,
                InspectionBooking.preferred_date == now.date(),
                or_(
                    InspectionBooking.status == "confirmed",
                    and_(
                        InspectionBooking.status == "new",
                        InspectionBooking.source == "staff",
                    ),
                ),
            )
            .order_by(InspectionBooking.preferred_time.asc())
            .all()
        )
        items.extend(planner_inspection_item(row) for row in bookings)

    items.sort(key=lambda item: item.scheduled_at)
    return items


@router.get(
    "/autoservice/dashboard/summary",
    response_model=AutoserviceDashboardSummary,
)
def get_autoservice_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    level = orders_access_level(db, current_user)
    summary = AutoserviceDashboardSummary(level=level)

    if level:
        orders_q = db.query(RepairOrder).filter(RepairOrder.organization_id == org_id)
        if level == "own":
            orders_q = orders_q.filter(
                _own_orders_visibility_clause(db, org_id, current_user)
            )
        summary.active_orders = orders_q.filter(
            RepairOrder.status.in_(ACTIVE_STATUSES)
        ).count()
        summary.in_progress_orders = orders_q.filter(
            RepairOrder.status == "in_progress"
        ).count()
        if level == "full":
            summary.review_orders = orders_q.filter(
                RepairOrder.status.in_(REVIEW_STATUSES)
            ).count()

    if has_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_INSPECTIONS):
        summary.new_bookings = (
            db.query(InspectionBooking)
            .filter(
                InspectionBooking.organization_id == org_id,
                InspectionBooking.status == "new",
            )
            .count()
        )

    if has_autoservice_permission(
        db, current_user, AUTOSERVICE_PERMISSION_CLIENTS
    ) or has_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_FINANCE):
        client_ids = [
            row.id
            for row in db.query(AutoserviceClient.id)
            .filter(AutoserviceClient.organization_id == org_id)
            .all()
        ]
        stats = client_stats_map(db, org_id, client_ids)
        debtors = [b for b in stats.values() if b["debt_amount"] > 0]
        summary.debt_total = sum(b["debt_amount"] for b in debtors) if debtors else Decimal("0.00")
        summary.debtors_count = len(debtors)

    if has_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_FINANCE):
        since = datetime.utcnow() - timedelta(days=30)
        summary.revenue_30d = (
            db.query(func.coalesce(func.sum(AutoservicePayment.amount), 0))
            .filter(
                AutoservicePayment.organization_id == org_id,
                AutoservicePayment.cancelled_at.is_(None),
                AutoservicePayment.created_at >= since,
            )
            .scalar()
        )

    summary.payroll_month = _payroll_month_block(db, org_id, current_user)
    summary.today = _today_items(db, org_id, current_user, level)
    return summary
