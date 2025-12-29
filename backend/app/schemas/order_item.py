from pydantic import BaseModel
from datetime import datetime
from decimal import Decimal

class OrderItemBase(BaseModel):
    guid: str
    stock_id: str
    partnumber: str
    brand: str
    quantity: int
    price: Decimal
    total_price: Decimal
    comment: str | None = None

class OrderItemCreate(OrderItemBase):
    order_id: int

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class OrderItemUpdate(BaseModel):
    quantity: int | None = None
    comment: str | None = None