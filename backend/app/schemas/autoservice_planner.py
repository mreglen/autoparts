from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

PlannerItemKind = Literal["order", "inspection"]


class PlannerRepairOrder(BaseModel):
    id: int
    kind: PlannerItemKind = "order"
    order_number: str
    client_id: Optional[int] = None
    client_name: str
    client_phone: str
    vehicle: str
    status: str
    scheduled_at: datetime
    scheduled_end_at: Optional[datetime] = None
    work_zone_id: Optional[int] = None
    work_zone_name: Optional[str] = None
    notes: Optional[str] = None


class PlannerWeekDayHeader(BaseModel):
    date: date


class PlannerWeekZoneDay(BaseModel):
    date: date
    orders: list[PlannerRepairOrder] = Field(default_factory=list)


class PlannerWeekZoneRow(BaseModel):
    id: Optional[int] = None
    name: str
    sort_order: int
    is_unassigned: bool = False
    days: list[PlannerWeekZoneDay] = Field(default_factory=list)


class PlannerWeekResponse(BaseModel):
    week_start: date
    week_end: date
    days: list[PlannerWeekDayHeader] = Field(default_factory=list)
    zones: list[PlannerWeekZoneRow] = Field(default_factory=list)
