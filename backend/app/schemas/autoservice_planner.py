from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class PlannerRepairOrder(BaseModel):
    id: int
    order_number: str
    client_id: int
    client_name: str
    client_phone: str
    vehicle: str
    status: str
    scheduled_at: datetime
    lift_number: Optional[int] = None


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
    days: list[PlannerDay]
