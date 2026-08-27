from datetime import datetime, date
from typing import Any, List, Optional
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
    part_type: Optional[PartType] = None
    is_on_avito: bool = False  # Indicates if product is published on Avito
    is_on_drom: bool = False  # Indicates if product is exported to Drom

    class Config:
        from_attributes = True


class ProductListOrganizationSummary(BaseModel):
    id: str
    name: Optional[str] = None
    phone: Optional[str] = None


class ProductListStorageSummary(BaseModel):
    id: int
    address: Optional[str] = None


class ProductListPhotoSummary(BaseModel):
    id: int
    photo_url: str
    full_url: str
    thumb_url: Optional[str] = None
    list_photo_url: Optional[str] = None


class ProductListItem(BaseModel):
    id: int
    brand: str
    article: str
    name: str
    price: float
    quantity: int
    is_new: bool
    organization_id: str
    storage_location_id: int
    created_at: Optional[datetime] = None
    list_photo_url: Optional[str] = None
    photos: List[ProductListPhotoSummary] = []
    organization: Optional[ProductListOrganizationSummary] = None
    storage_location: Optional[ProductListStorageSummary] = None


class ProductPhoto(BaseModel):
    id: int
    photo_url: str
    full_url: str
    thumb_url: Optional[str] = None
    list_photo_url: Optional[str] = None
    organization_id: Optional[str] = None
    processing_status: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        data = super().from_orm(obj)
        data.full_url = obj.full_url
        data.thumb_url = getattr(obj, "thumb_url", None) or None
        data.list_photo_url = getattr(obj, "list_photo_url", None) or obj.photo_url
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
    tecdoc_manufacturer_json: Optional[dict[str, Any]] = None
    tecdoc_model_json: Optional[dict[str, Any]] = None
    tecdoc_passengercar_json: Optional[dict[str, Any]] = None
    tecdoc_engine_json: Optional[dict[str, Any]] = None
    tecdoc_transmission_json: Optional[dict[str, Any]] = None

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


class QrProductStorageCellOut(BaseModel):
    id: int
    storage_cell_id: int
    value: Optional[str] = None
    storage_cell_name: Optional[str] = None

    class Config:
        from_attributes = True


class QrPartCardMovementOut(BaseModel):
    id: int
    quantity: int
    movement_date: Optional[date] = None
    reason: Optional[str] = None
    sale_price: Optional[float] = None
    sale_channel: Optional[str] = None
    source_kind: Optional[str] = None
    avito_order_id: Optional[str] = None
    user_name: Optional[str] = None


class QrPartCardResponse(BaseModel):
    id: int
    name: str
    brand: str
    article: str
    quantity: int
    reserved_qty: int = 0
    internal_code: Optional[str] = None
    source_pending_id: Optional[int] = None
    price: Optional[float] = None
    storage_location_id: Optional[int] = None
    storage_location_name: Optional[str] = None
    storage_addresses: List[str] = []
    product_storage_cells: List[QrProductStorageCellOut] = []
    photos: List[ProductPhoto] = []
    videos: List[ProductVideo] = []
    stock_outs: List[QrPartCardMovementOut] = []

    class Config:
        from_attributes = True
