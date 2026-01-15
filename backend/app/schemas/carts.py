from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NewPartsCartItem(BaseModel):
    brand: str
    partnumber: str
    name: Optional[str] = None
    delivery: Optional[str] = None
    quantity: int = 1
    price: float
    stock_id: str
    guid: Optional[str] = None
    delivery_start: Optional[datetime] = None
    delivery_end: Optional[datetime] = None


class UsedPartsCartItem(BaseModel):
    product_id: int
    quantity: int = 1

class CartItemResponse(BaseModel):
    id: int
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    name: Optional[str] = None
    delivery: Optional[str] = None
    quantity: int
    price: Optional[float] = None
    stock_id: Optional[str] = None
    product_id: Optional[int] = None
    seller: str
    created_at: datetime


class CartResponse(BaseModel):
    id: int
    user_id: int
    new_parts_items: list[CartItemResponse]
    used_parts_items: list[CartItemResponse]


class UpdateQuantityRequest(BaseModel):
    quantity: int
