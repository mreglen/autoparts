from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class PlannerRepairOrder(BaseModel):
    id: int
    order_number: str
    client_id: int
    client_name: str
    client_phone: str
    vehicle: str
    status: str
    scheduled_at: datetime
    scheduled_end_at: Optional[datetime] = None
    lift_id: Optional[int] = None
    lift_name: Optional[str] = None


class PlannerRepairBooking(BaseModel):
    id: int
    client_id: Optional[int] = None
    name: str
    phone: str
    preferred_date: date
    comment: Optional[str] = None
    status: str


class PlannerDay(BaseModel):
    date: date
    repair_orders: list[PlannerRepairOrder] = []
    repair_bookings: list[PlannerRepairBooking] = []


class PlannerResponse(BaseModel):
    date_from: date
    date_to: date
    days: list[PlannerDay] = []


class PlannerLiftColumn(BaseModel):
    id: int
    name: str
    sort_order: int
    orders: list[PlannerRepairOrder] = Field(default_factory=list)


class PlannerLiftsDayResponse(BaseModel):
    date: date
    lifts: list[PlannerLiftColumn] = Field(default_factory=list)
    unassigned_orders: list[PlannerRepairOrder] = Field(default_factory=list)
