from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class VinLookupRequest(BaseModel):
    vin: str = Field(..., min_length=1, max_length=32)


class PlateLookupRequest(BaseModel):
    plate: str = Field(..., min_length=1, max_length=20)
    country_code: str = Field(default="ru", min_length=2, max_length=8)


class VehicleAttributeRaw(BaseModel):
    key: Optional[str] = None
    value: Optional[str] = None
    name: Optional[str] = None


class NormalizedVehicleCandidateOut(BaseModel):
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    body: Optional[str] = None
    color: Optional[str] = None
    display_name: Optional[str] = None
    catalog: Optional[str] = None
    vehicle_id: Optional[str] = None
    ssd: Optional[str] = None
    filter_level: Optional[str] = None
    attributes_raw: list[dict[str, Any]] = Field(default_factory=list)


class ByVinResponse(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable"]
    message: Optional[str] = None
    candidates: list[NormalizedVehicleCandidateOut] = Field(default_factory=list)
    from_snapshot: bool = False
    snapshot_fetched_at: Optional[str] = None


class ByPlateResponse(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable"]
    message: Optional[str] = None
    plate: Optional[str] = None
    vin: Optional[str] = None
    candidates: list[NormalizedVehicleCandidateOut] = Field(default_factory=list)


class FrameLookupRequest(BaseModel):
    frame: str = Field(..., min_length=1, max_length=32)


class ByFrameResponse(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable"]
    message: Optional[str] = None
    frame: Optional[str] = None
    candidates: list[NormalizedVehicleCandidateOut] = Field(default_factory=list)
