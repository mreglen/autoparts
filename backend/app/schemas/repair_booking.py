from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


REPAIR_BOOKING_STATUSES = ("new", "processed", "cancelled")

RepairBookingStatus = Literal["new", "processed", "cancelled"]


class RepairBookingVehicleBrief(BaseModel):
    id: int
    make: str
    model: str
    year: Optional[int] = None
    plate: Optional[str] = None
    vin: Optional[str] = None

    model_config = {"from_attributes": True}


class RepairBookingCreate(BaseModel):
    """Client-side booking form: name/phone prefilled from profile, date required."""

    name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=5, max_length=40)
    preferred_date: date
    comment: Optional[str] = Field(None, max_length=2000)
    garage_vehicle_id: Optional[int] = Field(None, ge=1)


class RepairBookingStaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    preferred_date: date
    comment: Optional[str] = Field(None, max_length=2000)
    garage_vehicle_id: Optional[int] = Field(None, ge=1)


class RepairBookingPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=5, max_length=40)
    preferred_date: Optional[date] = None
    comment: Optional[str] = Field(None, max_length=2000)
    status: Optional[RepairBookingStatus] = None
    staff_notes: Optional[str] = Field(None, max_length=2000)


class RepairBookingView(BaseModel):
    id: int
    organization_id: str
    client_id: Optional[int] = None
    garage_vehicle_id: Optional[int] = None
    vehicle: Optional[RepairBookingVehicleBrief] = None
    name: str
    phone: str
    preferred_date: date
    comment: Optional[str] = None
    status: str
    source: str
    staff_notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
