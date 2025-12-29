from pydantic import BaseModel
from typing import Optional

class VehicleBase(BaseModel):
    brand: str
    model: str
    generation: Optional[str] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None

class VehicleCreate(VehicleBase):
    pass

class Vehicle(VehicleBase):
    id: int
    organization_id: str

    class Config:
        from_attributes = True  # для Pydantic v2 (ранее orm_mode = True)