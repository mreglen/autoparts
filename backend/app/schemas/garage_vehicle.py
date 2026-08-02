from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.laximo_vehicle import NormalizedVehicleCandidateOut


class GarageVehicleDecodeVinRequest(BaseModel):
    vin: str = Field(min_length=1, max_length=32)


class GarageVehicleDecodeVinResponse(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable"]
    message: Optional[str] = None
    candidates: list[NormalizedVehicleCandidateOut] = Field(default_factory=list)


class GarageVehicleDecodePlateRequest(BaseModel):
    plate: str = Field(min_length=1, max_length=20)
    country_code: str = Field(default="ru", min_length=2, max_length=8)


class GarageVehicleDecodePlateResponse(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable"]
    message: Optional[str] = None
    plate: Optional[str] = None
    vin: Optional[str] = None
    candidates: list[NormalizedVehicleCandidateOut] = Field(default_factory=list)


class GarageVehicleDecodeFrameRequest(BaseModel):
    frame: str = Field(min_length=1, max_length=32)


class GarageVehicleDecodeFrameResponse(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable"]
    message: Optional[str] = None
    frame: Optional[str] = None
    candidates: list[NormalizedVehicleCandidateOut] = Field(default_factory=list)


class GarageVehicleCreate(BaseModel):
    vin: Optional[str] = Field(None, max_length=32)
    make: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=80)
    year: Optional[int] = Field(None, ge=1900, le=2100)
    color: Optional[str] = Field(None, max_length=40)
    plate: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = Field(None, max_length=2000)
    source: Optional[str] = Field(None, max_length=32)
    laximo_catalog: Optional[str] = Field(None, max_length=64)
    laximo_vehicle_id: Optional[str] = Field(None, max_length=64)
    laximo_attributes: Optional[list[dict[str, Any]]] = None


class GarageVehicleStaffCreate(GarageVehicleCreate):
    client_id: int = Field(ge=1)


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
    laximo_catalog: Optional[str] = None
    laximo_vehicle_id: Optional[str] = None
    laximo_attributes: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
