from typing import List, Optional
from pydantic import BaseModel
from app.schemas.storage_location import StorageLocation
from app.schemas.organization import Organization
from app.schemas.part_type import PartType

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
    part_type_id: int  # Required field


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
    part_type_id: int  # Required field
    part_type: PartType  # Required field
    is_on_avito: bool = False  # Indicates if product is published on Avito

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
    part_type_id: int  # Required field


class ProductUpdate(BaseModel):
    """Schema for updating an existing product - all fields are optional except part_type_id"""
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = None
    internal_code: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    is_new: Optional[bool] = None
    storage_location_id: Optional[int] = None
    part_type_id: Optional[int] = None  # Can be updated, but if provided must be valid
    vehicle_ids: Optional[List[int]] = None
    photos: Optional[List[str]] = None
    videos: Optional[List[str]] = None

class ProductQuantityUpdate(BaseModel):
    quantity: int

class DeletePhotosRequest(BaseModel):
    photo_ids: List[int]  


class DeleteVideosRequest(BaseModel):
    video_ids: List[int]  


class QrPartCardResponse(BaseModel):
    id: int
    name: str
    brand: str
    article: str
    quantity: int
    internal_code: Optional[str] = None
    price: Optional[float] = None
    storage_location_name: Optional[str] = None
    storage_addresses: List[str] = []
    photos: List[ProductPhoto] = []
    videos: List[ProductVideo] = []

    class Config:
        from_attributes = True
