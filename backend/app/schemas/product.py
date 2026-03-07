from typing import List, Optional
from pydantic import BaseModel
from app.schemas.storage_location import StorageLocation
from app.schemas.organization import Organization

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
    videos: List["ProductVideo"] = []
    compatible_vehicles: List["Vehicle"] = [] 
    storage_location: Optional[StorageLocation] = None
    organization: Optional[Organization] = None

    class Config:
        from_attributes = True


class ProductPhoto(BaseModel):
    id: int
    photo_url: str
    full_url: str
    organization_id: Optional[str] = None
    processing_status: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        data.full_url = obj.full_url  
        return data


class ProductVideo(BaseModel):
    id: int
    video_url: str
    full_url: str
    organization_id: Optional[str] = None
    processing_status: Optional[str] = None

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
    videos: Optional[List[str]] = None


class ProductUpdate(BaseModel):
    """Schema for updating an existing product - all fields are optional"""
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    internal_code: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    is_new: Optional[bool] = None
    storage_location_id: Optional[int] = None
    vehicle_ids: Optional[List[int]] = None
    photos: Optional[List[str]] = None
    videos: Optional[List[str]] = None

class ProductQuantityUpdate(BaseModel):
    quantity: int

class DeletePhotosRequest(BaseModel):
    photo_ids: List[int]  


class DeleteVideosRequest(BaseModel):
    video_ids: List[int]  
