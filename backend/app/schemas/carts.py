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
    purchase_price: Optional[float] = None
    stock_id: str
    max_quantity: Optional[int] = None
    guid: Optional[str] = None
    delivery_start: Optional[datetime] = None
    delivery_end: Optional[datetime] = None
    basket_id: Optional[int] = None


class UsedPartsCartItem(BaseModel):
    product_id: int
    quantity: int = 1


class CartItemResponse(BaseModel):
    id: int
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    name: Optional[str] = None
    delivery: Optional[str] = None
    delivery_start: Optional[datetime] = None
    delivery_end: Optional[datetime] = None
    quantity: int
    max_quantity: Optional[int] = None
    price: Optional[float] = None
    purchase_price: Optional[float] = None
    stock_id: Optional[str] = None
    product_id: Optional[int] = None
    seller: str
    created_at: datetime
    basket_id: Optional[int] = None


class NewPartsBasketResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    items: list[CartItemResponse]
    item_count: int = 0
    total_price: float = 0


class CreateBasketRequest(BaseModel):
    name: str


class RenameBasketRequest(BaseModel):
    name: str


class CartResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    new_parts_baskets: list[NewPartsBasketResponse] = []
    new_parts_items: list[CartItemResponse]
    used_parts_items: list[CartItemResponse]


class UpdateQuantityRequest(BaseModel):
    quantity: int
