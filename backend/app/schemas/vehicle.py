from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VehiclePhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    photo_path: str
    processing_status: str
    sort_order: int


class VehicleUpdate(BaseModel):
    """Частичное обновление; поля не переданные в теле запроса не меняются."""

    brand: Optional[str] = None
    model: Optional[str] = None
    generation: Optional[str] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    transmission_id: Optional[int] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None
    price: Optional[Decimal] = None
    tecdoc_manufacturer_id: Optional[int] = None
    tecdoc_model_id: Optional[int] = None
    tecdoc_passengercar_id: Optional[int] = None
    tecdoc_engine_id: Optional[int] = None
    tecdoc_transmission_json: Optional[dict[str, Any]] = None
    description: Optional[str] = Field(None, max_length=8000)


class VehicleCreate(BaseModel):
    brand: str
    model: str
    generation: Optional[str] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    transmission_id: Optional[int] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None
    tecdoc_manufacturer_id: Optional[int] = None
    tecdoc_model_id: Optional[int] = None
    tecdoc_passengercar_id: Optional[int] = None
    tecdoc_engine_id: Optional[int] = None
    price: Optional[Decimal] = None
    description: Optional[str] = Field(None, max_length=8000)
    photos: list[str] = Field(
        default_factory=list,
        description="Temp paths from POST /upload/photo, e.g. /temp/{org_id}/{file}",
    )
    tecdoc_transmission_json: Optional[dict[str, Any]] = None

    @field_validator("photos")
    @classmethod
    def max_ten_photos(cls, v: list[str]) -> list[str]:
        if len(v) > 10:
            raise ValueError("Максимум 10 фотографий")
        return v


class Vehicle(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    organization_id: str
    created_by: int
    brand: str
    model: str
    generation: Optional[str] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    transmission_id: Optional[int] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None
    tecdoc_manufacturer_id: Optional[int] = None
    tecdoc_model_id: Optional[int] = None
    tecdoc_passengercar_id: Optional[int] = None
    tecdoc_engine_id: Optional[int] = None
    price: Optional[Decimal] = None
    description: Optional[str] = None
    tecdoc_manufacturer_json: Optional[dict[str, Any]] = None
    tecdoc_model_json: Optional[dict[str, Any]] = None
    tecdoc_passengercar_json: Optional[dict[str, Any]] = None
    tecdoc_engine_json: Optional[dict[str, Any]] = None
    tecdoc_transmission_json: Optional[dict[str, Any]] = None
    photos: list[VehiclePhotoOut] = Field(default_factory=list)
