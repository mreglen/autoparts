from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PendingProductBase(BaseModel):
    article: str
    name: str
    brand: str
    description: Optional[str] = None
    is_new: bool = True
    price: float
    quantity: int
    storage_location_id: int
    photos: Optional[List[str]] = None
    vehicle_ids: Optional[List[int]] = None


class PendingProductCreate(PendingProductBase):
    pass


class PendingProductUpdate(BaseModel):
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    is_new: Optional[bool] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    storage_location_id: Optional[int] = None
    photos: Optional[List[str]] = None
    vehicle_ids: Optional[List[int]] = None


class PendingProduct(PendingProductBase):
    id: int
    internal_code: str
    organization_id: str
    created_by: int
    created_at: datetime
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True