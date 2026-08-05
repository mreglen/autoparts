from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


REPAIR_BOOKING_STATUSES = ("new", "processed", "cancelled")

RepairBookingStatus = Literal["new", "processed", "cancelled"]


class RepairBookingCreate(BaseModel):
    """Client-side booking form: name/phone prefilled from profile, date required."""

    name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=5, max_length=40)
    preferred_date: date
    comment: Optional[str] = Field(None, max_length=2000)


class RepairBookingPatch(BaseModel):
    status: Optional[RepairBookingStatus] = None
    staff_notes: Optional[str] = Field(None, max_length=2000)


class RepairBookingView(BaseModel):
    id: int
    organization_id: str
    client_id: Optional[int] = None
    name: str
    phone: str
    preferred_date: date
    comment: Optional[str] = None
    status: str
    source: str
    staff_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
