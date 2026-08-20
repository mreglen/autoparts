from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


ACTIVE_STATUSES = ("pending", "in_progress", "done")
HISTORY_STATUSES = ("completed", "cancelled")
ALL_STATUSES = ACTIVE_STATUSES + HISTORY_STATUSES
# Legacy aliases kept for migration/display
LEGACY_STATUS_MAP = {
    "accepted": "pending",
    "ready": "completed",
    "issued": "completed",
    "open": "pending",
}
SHOP_PART_SOURCES = ("manual", "warehouse", "rossko", "autoservice_stock")
SHOP_PART_UNITS = ("pcs", "l", "kg")


class RepairOrderUserBrief(BaseModel):
    id: int
    name: str


class RepairOrderVehicleBrief(BaseModel):
    id: int
    make: str
    model: str
    year: Optional[int] = None
    vin: Optional[str] = None
    plate: Optional[str] = None


class RepairOrderClientBrief(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    user_id: Optional[int] = None
    person_type: str = "individual"
    legal_name: Optional[str] = None
    address: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None


class RepairOrderWorkZoneBrief(BaseModel):
    id: int
    name: str
    sort_order: int

    model_config = {"from_attributes": True}


class RepairOrderEmployeeBrief(BaseModel):
    id: int
    name: str


class RepairOrderWorkExecutorIn(BaseModel):
    employee_id: int
    percent: Decimal = Field(ge=0, le=100)


class RepairOrderWorkExecutorView(BaseModel):
    employee_id: int
    employee: RepairOrderEmployeeBrief
    percent: Decimal
    pay_amount: Decimal


class RepairOrderWorkIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    catalog_work_id: Optional[int] = None
    qty: int = Field(ge=1)
    unit_price: Decimal = Field(ge=0)
    executors: list[RepairOrderWorkExecutorIn] = Field(default_factory=list)
    executor_user_id: Optional[int] = None


class RepairOrderClientPartIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    qty: int = Field(ge=1)
    unit: Literal["pcs", "l", "kg"] = "pcs"


class RepairOrderShopPartIn(BaseModel):
    id: Optional[int] = None
    title: str = Field(min_length=1, max_length=255)
    qty: Decimal = Field(default=Decimal("1"), ge=Decimal("0.001"))
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal = Field(ge=0)
    markup_percent: Decimal = Field(default=Decimal("5"), ge=0)
    client_unit_price_override: Optional[Decimal] = Field(None, ge=0)
    source: Literal["manual", "warehouse", "rossko", "autoservice_stock"] = "manual"
    product_id: Optional[int] = None
    autoservice_stock_item_id: Optional[int] = None
    brand: Optional[str] = Field(None, max_length=120)
    partnumber: Optional[str] = Field(None, max_length=120)
    rossko_brand: Optional[str] = Field(None, max_length=120)
    rossko_partnumber: Optional[str] = Field(None, max_length=120)


class ManualShopPartUpdate(BaseModel):
    brand: str = Field("", max_length=120)
    article: str = Field("", max_length=120)
    name: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0)
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal = Field(ge=0)


class RepairOrderPurchaseImportIn(BaseModel):
    order_type: Literal["new", "used"]
    item_ids: list[int] = Field(min_length=1)
    markup_percent: Decimal = Field(default=Decimal("0"), ge=0, le=500)
    item_price_overrides: dict[int, Decimal] = Field(default_factory=dict)


class RepairOrderWorkView(BaseModel):
    id: int
    position: int
    catalog_work_id: Optional[int] = None
    title: str
    qty: int
    unit_price: Decimal
    line_sum: Decimal
    executors: list[RepairOrderWorkExecutorView] = Field(default_factory=list)
    executor_user_id: Optional[int] = None
    executor: Optional[RepairOrderUserBrief] = None


class RepairOrderClientWorkView(BaseModel):
    """Client-facing work line without executor."""

    id: int
    position: int
    title: str
    qty: int
    unit_price: Decimal
    line_sum: Decimal


class RepairOrderClientPartView(BaseModel):
    id: int
    position: int
    title: str
    qty: int
    unit: str = "pcs"


class RepairOrderShopPartView(BaseModel):
    id: int
    position: int
    title: str
    display_name: str
    qty: Decimal
    unit: str
    unit_price: Decimal
    markup_percent: Decimal
    client_unit_price_override: Optional[Decimal] = None
    price_with_markup: Decimal
    line_sum: Decimal
    source: str
    product_id: Optional[int] = None
    autoservice_stock_item_id: Optional[int] = None
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    rossko_brand: Optional[str] = None
    rossko_partnumber: Optional[str] = None
    is_imported: bool = False
    is_manual_editable: bool = False
    stock_max_qty: Optional[int] = None


class RepairOrderClientShopPartView(BaseModel):
    """Client-facing shop part without markup/source internals."""

    id: int
    position: int
    title: str
    display_name: str
    qty: Decimal
    unit: str
    price_with_markup: Decimal
    line_sum: Decimal


class RepairOrderCreate(BaseModel):
    client_id: int
    vehicle_id: int
    scheduled_at: datetime
    scheduled_end_at: Optional[datetime] = None
    shipping_date: Optional[date] = None
    client_comment: Optional[str] = Field(None, max_length=4000)
    staff_comment: Optional[str] = Field(None, max_length=4000)
    work_zone_id: Optional[int] = None
    assignee_user_ids: list[int] = Field(default_factory=list)
    works: list[RepairOrderWorkIn] = Field(default_factory=list)
    client_parts: list[RepairOrderClientPartIn] = Field(default_factory=list)
    shop_parts: list[RepairOrderShopPartIn] = Field(default_factory=list)


class RepairOrderUpdate(BaseModel):
    client_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    scheduled_end_at: Optional[datetime] = None
    shipping_date: Optional[date] = None
    client_comment: Optional[str] = Field(None, max_length=4000)
    staff_comment: Optional[str] = Field(None, max_length=4000)
    work_zone_id: Optional[int] = None
    assignee_user_ids: Optional[list[int]] = None
    works: Optional[list[RepairOrderWorkIn]] = None
    client_parts: Optional[list[RepairOrderClientPartIn]] = None
    shop_parts: Optional[list[RepairOrderShopPartIn]] = None


class RepairOrderStatusPatch(BaseModel):
    status: Literal["pending", "in_progress", "done", "completed", "cancelled"]


class RepairOrderAutoserviceStockItemIn(BaseModel):
    item_id: int
    qty: int = Field(ge=1)


class RepairOrderAutoserviceStockImportIn(BaseModel):
    items: list[RepairOrderAutoserviceStockItemIn] = Field(min_length=1)
    markup_percent: Decimal = Field(default=Decimal("0"), ge=0, le=500)


class RepairOrderStaffView(BaseModel):
    id: int
    organization_id: str
    order_number: str
    client_id: int
    vehicle_id: int
    client_comment: Optional[str] = None
    staff_comment: Optional[str] = None
    work_zone_id: Optional[int] = None
    work_zone: Optional[RepairOrderWorkZoneBrief] = None
    scheduled_at: datetime
    scheduled_end_at: Optional[datetime] = None
    shipping_date: Optional[date] = None
    accepted_by_user_id: int
    status: str
    created_at: datetime
    updated_at: datetime
    client: RepairOrderClientBrief
    vehicle: RepairOrderVehicleBrief
    accepted_by: RepairOrderUserBrief
    assignees: list[RepairOrderUserBrief] = Field(default_factory=list)
    works: list[RepairOrderWorkView] = Field(default_factory=list)
    client_parts: list[RepairOrderClientPartView] = Field(default_factory=list)
    shop_parts: list[RepairOrderShopPartView] = Field(default_factory=list)
    works_total: Decimal = Decimal("0.00")
    shop_parts_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    remaining_amount: Decimal = Decimal("0.00")
    is_paid: bool = False


class RepairOrderClientView(BaseModel):
    id: int
    order_number: str
    vehicle_id: int
    client_comment: Optional[str] = None
    work_zone_id: Optional[int] = None
    work_zone: Optional[RepairOrderWorkZoneBrief] = None
    scheduled_at: datetime
    scheduled_end_at: Optional[datetime] = None
    status: str
    created_at: datetime
    vehicle: RepairOrderVehicleBrief
    works: list[RepairOrderClientWorkView] = Field(default_factory=list)
    client_parts: list[RepairOrderClientPartView] = Field(default_factory=list)
    shop_parts: list[RepairOrderClientShopPartView] = Field(default_factory=list)
    works_total: Decimal = Decimal("0.00")
    shop_parts_total: Decimal = Decimal("0.00")
    grand_total: Decimal = Decimal("0.00")


class RepairOrderStaffOption(BaseModel):
    id: int
    name: str


class RepairOrderServiceEmployeeOption(BaseModel):
    id: int
    name: str
    work_percent: Decimal


class RepairOrderWorkZonesMeta(BaseModel):
    work_zones: list[RepairOrderWorkZoneBrief] = Field(default_factory=list)


class WarehouseProductOption(BaseModel):
    id: int
    title: str
    price: Decimal
    article: Optional[str] = None
    brand: Optional[str] = None
    internal_code: Optional[str] = None
    available_qty: int = 0
