from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

AutoservicePaymentMethod = Literal["card", "cash", "bank"]


class AutoservicePaymentIn(BaseModel):
    method: AutoservicePaymentMethod
    amount: Decimal = Field(gt=0)
    paid_at: Optional[date] = None


class AutoservicePaymentMethodTotals(BaseModel):
    card: Decimal = Decimal("0.00")
    cash: Decimal = Decimal("0.00")
    bank: Decimal = Decimal("0.00")


class AutoserviceFinanceReceiptRow(BaseModel):
    sequential_number: int
    repair_order_id: int
    repair_order_number: str
    client_name: str
    amount: Decimal
    method: AutoservicePaymentMethod
    created_at: datetime


class AutoserviceFinanceReceiptsResponse(BaseModel):
    totals: AutoservicePaymentMethodTotals
    total_amount: Decimal = Decimal("0.00")
    count: int = 0
    items: list[AutoserviceFinanceReceiptRow] = Field(default_factory=list)


class AutoservicePayrollReportEmployeeRow(BaseModel):
    employee_id: int
    name: str
    completed_orders: int = 0
    from_works: Decimal = Decimal("0.00")
    from_daily: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")


class AutoservicePayrollReportResponse(BaseModel):
    year: int
    month: int
    total: Decimal = Decimal("0.00")
    employees: list[AutoservicePayrollReportEmployeeRow] = Field(default_factory=list)
