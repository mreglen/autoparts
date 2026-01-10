from typing import List, Optional
from pydantic import BaseModel

class ProductBase(BaseModel):
    article: str
    name: str
    brand: str
    price: float
    internal_code: Optional[str] = None
    description: Optional[str] = None
    quantity: int
    is_new: bool = True
    storage_location_id: int


class Product(ProductBase):
    id: int
    organization_id: str
    storage_location_id: int
    created_by: int
    creator_name: Optional[str] = None 
    photos: List["ProductPhoto"] = [] 
    compatible_vehicles: List["Vehicle"] = [] 

    class Config:
        from_attributes = True


class ProductPhoto(BaseModel):
    id: int
    photo_url: str
    full_url: str

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        data.full_url = obj.full_url  
        return data


class VehicleBase(BaseModel):
    brand: str
    model: str
    generation: Optional[str] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    vin: Optional[str] = None
    mileage: Optional[int] = None

    class Config:
        from_attributes = True


class Vehicle(VehicleBase):
    id: int

    class Config:
        from_attributes = True


class ProductCreate(ProductBase):
    internal_code: Optional[str] = None  # Теперь опционально, будет генерироваться автоматически
    vehicle_ids: Optional[List[int]] = None
    photos: Optional[List[str]] = None

class ProductQuantityUpdate(BaseModel):
    quantity: int

class DeletePhotosRequest(BaseModel):
    photo_ids: List[int]  
