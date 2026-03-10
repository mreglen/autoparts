from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class RejectedProductBase(BaseModel):
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    is_new: bool = True
    price: Optional[float] = None
    quantity: Optional[int] = None
    storage_location_id: Optional[int] = None
    photos: Optional[List[str]] = None
    videos: Optional[List[str]] = None
    vehicle_ids: Optional[List[int]] = None


class RejectedProductCreate(RejectedProductBase):
    pass


class RejectedProduct(RejectedProductBase):
    id: int
    created_at: datetime
    rejected_at: datetime
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True