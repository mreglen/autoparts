from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


ACTIVE_STATUSES = ("accepted", "in_progress", "ready")
HISTORY_STATUSES = ("issued", "cancelled")
ALL_STATUSES = ACTIVE_STATUSES + HISTORY_STATUSES
SHOP_PART_SOURCES = ("manual", "warehouse", "rossko")


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


class RepairOrderWorkIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    qty: int = Field(ge=1)
    unit_price: Decimal = Field(ge=0)
    executor_user_id: Optional[int] = None


class RepairOrderClientPartIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    qty: int = Field(ge=1)


class RepairOrderShopPartIn(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    qty: int = Field(ge=1)
    unit_price: Decimal = Field(ge=0)
    markup_percent: Decimal = Field(default=Decimal("5"), ge=0)
    source: Literal["manual", "warehouse", "rossko"] = "manual"
    product_id: Optional[int] = None
    rossko_brand: Optional[str] = Field(None, max_length=120)
    rossko_partnumber: Optional[str] = Field(None, max_length=120)


class RepairOrderWorkView(BaseModel):
    id: int
    position: int
    title: str
    qty: int
    unit_price: Decimal
    line_sum: Decimal
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


class RepairOrderShopPartView(BaseModel):
    id: int
    position: int
    title: str
    qty: int
    unit_price: Decimal
    markup_percent: Decimal
    price_with_markup: Decimal
    line_sum: Decimal
    source: str
    product_id: Optional[int] = None
    rossko_brand: Optional[str] = None
    rossko_partnumber: Optional[str] = None


class RepairOrderClientShopPartView(BaseModel):
    """Client-facing shop part without markup/source internals."""

    id: int
    position: int
    title: str
    qty: int
    price_with_markup: Decimal
    line_sum: Decimal


class RepairOrderCreate(BaseModel):
    client_id: int
    vehicle_id: int
    scheduled_at: datetime
    client_comment: Optional[str] = Field(None, max_length=4000)
    staff_comment: Optional[str] = Field(None, max_length=4000)
    lift_number: Optional[int] = Field(None, ge=1)
    assignee_user_ids: list[int] = Field(default_factory=list)
    works: list[RepairOrderWorkIn] = Field(default_factory=list)
    client_parts: list[RepairOrderClientPartIn] = Field(default_factory=list)
    shop_parts: list[RepairOrderShopPartIn] = Field(default_factory=list)


class RepairOrderUpdate(BaseModel):
    client_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    client_comment: Optional[str] = Field(None, max_length=4000)
    staff_comment: Optional[str] = Field(None, max_length=4000)
    lift_number: Optional[int] = None
    assignee_user_ids: Optional[list[int]] = None
    works: Optional[list[RepairOrderWorkIn]] = None
    client_parts: Optional[list[RepairOrderClientPartIn]] = None
    shop_parts: Optional[list[RepairOrderShopPartIn]] = None


class RepairOrderStatusPatch(BaseModel):
    status: Literal["accepted", "in_progress", "ready", "issued", "cancelled"]


class RepairOrderStaffView(BaseModel):
    id: int
    organization_id: str
    order_number: str
    client_id: int
    vehicle_id: int
    client_comment: Optional[str] = None
    staff_comment: Optional[str] = None
    lift_number: Optional[int] = None
    scheduled_at: datetime
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


class RepairOrderClientView(BaseModel):
    id: int
    order_number: str
    vehicle_id: int
    client_comment: Optional[str] = None
    lift_number: Optional[int] = None
    scheduled_at: datetime
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


class RepairOrderLiftsMeta(BaseModel):
    lifts_count: int


class WarehouseProductOption(BaseModel):
    id: int
    title: str
    price: Decimal
    article: Optional[str] = None
    internal_code: Optional[str] = None
