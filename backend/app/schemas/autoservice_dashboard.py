from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.autoservice_planner import PlannerRepairOrder


class AutoserviceDashboardPayrollBlock(BaseModel):
    year: int
    month: int
    total: Decimal = Decimal("0.00")
    completed_orders: int = 0


class AutoserviceDashboardSummary(BaseModel):
    level: Optional[str] = None
    active_orders: Optional[int] = None
    in_progress_orders: Optional[int] = None
    review_orders: Optional[int] = None
    new_bookings: Optional[int] = None
    debt_total: Optional[Decimal] = None
    debtors_count: Optional[int] = None
    revenue_30d: Optional[Decimal] = None
    payroll_month: Optional[AutoserviceDashboardPayrollBlock] = None
    today: list[PlannerRepairOrder] = Field(default_factory=list)
