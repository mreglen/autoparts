from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class GarageVehicleDecodeVinRequest(BaseModel):
    vin: str = Field(min_length=1, max_length=32)


class GarageVehicleDecodeVinResponse(BaseModel):
    ok: bool
    reason: Optional[str] = None


class GarageVehicleCreate(BaseModel):
    vin: Optional[str] = Field(None, max_length=32)
    make: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    color: Optional[str] = Field(None, max_length=40)
    plate: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)


class GarageVehicleUpdate(BaseModel):
    vin: Optional[str] = Field(None, max_length=32)
    make: Optional[str] = Field(None, min_length=1, max_length=80)
    model: Optional[str] = Field(None, min_length=1, max_length=80)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    color: Optional[str] = Field(None, max_length=40)
    plate: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)


class GarageVehicleView(BaseModel):
    id: int
    client_id: int
    organization_id: str
    vin: Optional[str] = None
    make: str
    model: str
    year: Optional[int] = None
    color: Optional[str] = None
    plate: Optional[str] = None
    notes: Optional[str] = None
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
