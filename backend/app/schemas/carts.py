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


class CartItemResponse(BaseModel):
    id: int
    brand: str
    partnumber: str
    name: Optional[str]
    delivery: Optional[str]
    quantity: int
    price: float
    stock_id: str
    seller: str
    created_at: datetime


class CartResponse(BaseModel):
    id: int
    user_id: int
    new_parts_items: list[CartItemResponse]
    used_parts_items: list[CartItemResponse]


class UpdateQuantityRequest(BaseModel):
    quantity: int
