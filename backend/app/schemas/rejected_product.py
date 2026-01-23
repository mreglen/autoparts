from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class RejectedProductBase(BaseModel):
    article: str
    name: str
    brand: str
    internal_code: str
    description: Optional[str] = None
    is_new: bool = True
    price: float
    quantity: int
    organization_id: str
    storage_location_id: int
    created_by: int
    rejection_reason: str
    photos: Optional[List[str]] = None
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