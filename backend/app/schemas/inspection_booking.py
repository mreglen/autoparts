from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


InspectionBookingStatus = Literal["new", "processed", "cancelled"]
InspectionBookingSource = Literal["site", "staff", "client"]


class InspectionBookingVehicleBrief(BaseModel):
    id: int
    make: str
    model: str
    year: Optional[int] = None
    plate: Optional[str] = None
    vin: Optional[str] = None

    model_config = {"from_attributes": True}


class InspectionBookingPublicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    preferred_date: date


class InspectionBookingClientCreate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    phone: Optional[str] = Field(None, min_length=5, max_length=40)
    preferred_date: date
    notes: Optional[str] = Field(None, max_length=2000)
    garage_vehicle_id: Optional[int] = Field(None, ge=1)


class InspectionBookingStaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    preferred_date: date
    notes: Optional[str] = Field(None, max_length=2000)
    garage_vehicle_id: Optional[int] = Field(None, ge=1)


class InspectionBookingPatch(BaseModel):
    status: Optional[InspectionBookingStatus] = None
    notes: Optional[str] = Field(None, max_length=2000)


class InspectionBookingView(BaseModel):
    id: int
    organization_id: str
    client_id: Optional[int] = None
    garage_vehicle_id: Optional[int] = None
    vehicle: Optional[InspectionBookingVehicleBrief] = None
    name: str
    phone: str
    preferred_date: date
    status: str
    source: str
    created_by_user_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
