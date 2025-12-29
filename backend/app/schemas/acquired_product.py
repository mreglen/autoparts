from pydantic import BaseModel
from datetime import date

class AcquiredProductBase(BaseModel):
    purchase_price: float
    is_kit: bool = False
    acquisition_date: date

class AcquiredProductCreate(AcquiredProductBase):
    product_id: int
    organization_id: int

class AcquiredProduct(AcquiredProductBase):
    id: int
    product_id: int
    organization_id: int

    class Config:
        from_attributes = True