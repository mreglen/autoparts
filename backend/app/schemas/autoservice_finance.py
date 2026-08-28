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
    id: int
    sequential_number: int
    repair_order_id: int
    repair_order_number: str
    client_name: str
    client_phone: str = ""
    amount: Decimal
    method: AutoservicePaymentMethod
    created_at: datetime


class RepairOrderPaymentView(BaseModel):
    id: int
    sequential_number: int
    method: AutoservicePaymentMethod
    amount: Decimal
    created_at: datetime


class RepairOrderPaymentsListResponse(BaseModel):
    items: list[RepairOrderPaymentView] = Field(default_factory=list)


class AutoservicePaymentDateUpdate(BaseModel):
    paid_at: date


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


class AutoservicePayrollWorkRow(BaseModel):
    work_id: Optional[int] = None
    title: str
    qty: Optional[int] = None
    unit_price: Optional[Decimal] = None
    line_total: Optional[Decimal] = None
    percent: Optional[Decimal] = None
    accrual_type: str
    accrual_type_label: str
    amount: Decimal = Decimal("0.00")


class AutoserviceMyPayrollOrderRow(AutoservicePayrollReportOrderRow):
    works: list[AutoservicePayrollWorkRow] = Field(default_factory=list)


class AutoserviceMyPayrollResponse(BaseModel):
    year: int
    month: int
    employee_id: int
    name: str
    position: Optional[str] = None
    salary_type: str
    salary_amount: Decimal = Decimal("0.00")
    work_percent: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    completed_orders: int = 0
    from_works: Decimal = Decimal("0.00")
    from_daily: Decimal = Decimal("0.00")
    from_fixed: Decimal = Decimal("0.00")
    orders: list[AutoserviceMyPayrollOrderRow] = Field(default_factory=list)


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


class RosskoSalesReportLineItem(BaseModel):
    item_id: int
    brand: str = ""
    partnumber: str = ""
    name: str = ""
    quantity: int = 0
    sale_unit_price: Decimal = Decimal("0.00")
    supplier_unit_price: Decimal = Decimal("0.00")
    sale_total: Decimal = Decimal("0.00")
    supplier_total: Decimal = Decimal("0.00")
    refund_amount: Decimal = Decimal("0.00")
    acquiring_fee: Decimal | None = None
    margin: Decimal | None = None
    site_income: Decimal | None = None
    organization_income: Decimal | None = None
    pending_acquiring: bool = False


class RosskoSalesReportRow(BaseModel):
    order_id: int
    operation_at: datetime | None = None
    rossko_order_id: str | None = None
    buyer_name: str = ""
    buyer_phone: str = ""
    payment_method: str = ""
    payment_method_label: str = ""
    is_paid: bool = False
    sale_total: Decimal = Decimal("0.00")
    supplier_total: Decimal = Decimal("0.00")
    acquiring_fee: Decimal | None = None
    refund_amount: Decimal = Decimal("0.00")
    refund_at: datetime | None = None
    margin: Decimal | None = None
    site_income: Decimal | None = None
    organization_income: Decimal | None = None
    pending_acquiring: bool = False
    items: list[RosskoSalesReportLineItem] = Field(default_factory=list)


class RosskoSalesReportSummary(BaseModel):
    count: int = 0
    sale_total: Decimal = Decimal("0.00")
    supplier_total: Decimal = Decimal("0.00")
    acquiring_fee: Decimal = Decimal("0.00")
    refund_total: Decimal = Decimal("0.00")
    margin: Decimal = Decimal("0.00")
    site_income: Decimal = Decimal("0.00")
    organization_income: Decimal = Decimal("0.00")
    pending_count: int = 0


class RosskoSalesReportResponse(BaseModel):
    date_from: date
    date_to: date
    summary: RosskoSalesReportSummary
    items: list[RosskoSalesReportRow] = Field(default_factory=list)
