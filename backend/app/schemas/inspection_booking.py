from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


InspectionBookingStatus = Literal["new", "processed", "cancelled"]
InspectionBookingSource = Literal["site", "staff"]


class InspectionBookingPublicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    preferred_date: date


class InspectionBookingStaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)
    preferred_date: date
    notes: Optional[str] = Field(None, max_length=2000)


class InspectionBookingPatch(BaseModel):
    status: Optional[InspectionBookingStatus] = None
    notes: Optional[str] = Field(None, max_length=2000)


class InspectionBookingView(BaseModel):
    id: int
    organization_id: str
    name: str
    phone: str
    preferred_date: date
    status: str
    source: str
    created_by_user_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
