from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

AutoservicePaymentMethod = Literal["card", "cash", "bank"]


class AutoservicePaymentIn(BaseModel):
    method: AutoservicePaymentMethod
    amount: Decimal = Field(gt=0)
    paid_at: Optional[date] = None
    payer_id: Optional[int] = None
    payer_name: Optional[str] = Field(None, max_length=255)


class AutoservicePaymentMethodTotals(BaseModel):
    card: Decimal = Decimal("0.00")
    cash: Decimal = Decimal("0.00")
    bank: Decimal = Decimal("0.00")


class AutoserviceFinanceReceiptRow(BaseModel):
    id: int
    sequential_number: int
    repair_order_id: int
    repair_order_number: str
    client_name: str
    payer_id: Optional[int] = None
    payer_name: str
    amount: Decimal
    method: AutoservicePaymentMethod
    created_at: datetime


class AutoservicePaymentDateUpdate(BaseModel):
    paid_at: date


class AutoservicePaymentPayerUpdate(BaseModel):
    payer_id: Optional[int] = None


class AutoserviceFinanceReceiptsResponse(BaseModel):
    totals: AutoservicePaymentMethodTotals
    total_amount: Decimal = Decimal("0.00")
    count: int = 0
    items: list[AutoserviceFinanceReceiptRow] = Field(default_factory=list)


class AutoservicePayrollReportOrderVehicle(BaseModel):
    id: int
    make: str
    model: str
    year: Optional[int] = None
    vin: Optional[str] = None
    plate: Optional[str] = None


class AutoservicePayrollReportOrderRow(BaseModel):
    order_id: int
    order_number: str
    vehicle: Optional[AutoservicePayrollReportOrderVehicle] = None
    amount: Decimal = Decimal("0.00")


class AutoservicePayrollReportEmployeeRow(BaseModel):
    employee_id: int
    name: str
    completed_orders: int = 0
    total: Decimal = Decimal("0.00")
    orders: list[AutoservicePayrollReportOrderRow] = Field(default_factory=list)


class AutoservicePayrollReportResponse(BaseModel):
    year: int
    month: int
    total: Decimal = Decimal("0.00")
    employees: list[AutoservicePayrollReportEmployeeRow] = Field(default_factory=list)


class AutoserviceOrderEconomicsVehicle(BaseModel):
    id: int
    make: str
    model: str
    year: Optional[int] = None
    plate: Optional[str] = None


AutoserviceOrderEconomicsPaymentStatus = Literal["paid", "partial", "unpaid"]


class AutoserviceOrderEconomicsRow(BaseModel):
    order_id: int
    order_number: str
    status: str
    client_name: str
    client_phone: str = ""
    vehicle: Optional[AutoserviceOrderEconomicsVehicle] = None
    scheduled_at: datetime
    grand_total: Decimal = Decimal("0.00")
    parts_cost: Decimal = Decimal("0.00")
    payroll_total: Decimal = Decimal("0.00")
    net_profit: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    remaining_amount: Decimal = Decimal("0.00")
    is_paid: bool = False
    payment_status: AutoserviceOrderEconomicsPaymentStatus
    is_preliminary: bool = False
    works_count: int = 0
    shop_parts_count: int = 0


class AutoserviceOrderEconomicsSummary(BaseModel):
    count: int = 0
    revenue: Decimal = Decimal("0.00")
    parts_cost: Decimal = Decimal("0.00")
    payroll_total: Decimal = Decimal("0.00")
    net_profit: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    debt_amount: Decimal = Decimal("0.00")
    unpaid_count: int = 0


class AutoserviceOrderEconomicsResponse(BaseModel):
    date_from: date
    date_to: date
    summary: AutoserviceOrderEconomicsSummary
    items: list[AutoserviceOrderEconomicsRow] = Field(default_factory=list)
