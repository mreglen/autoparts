from typing import Optional
from pydantic import BaseModel
from datetime import date, datetime

from app.schemas.product import Product
from app.schemas.storage_location import StorageLocation 

class StockInBase(BaseModel):
    product_id: int
    storage_location_id: int
    quantity: int
    sale_price: float
    acquired_product_id: Optional[int] = None

class StockInCreate(StockInBase):
    pass

class StockIn(StockInBase):
    id: int
    product: Optional[Product] = None
    organization_id: str
    created_at: date
    created_by: int
    creator_name: Optional[str] = None
    storage_location: Optional[StorageLocation] = None

    class Config:
        from_attributes = True