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
    supplier_unit_price: Optional[float] = None
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
    supplier_unit_price: Optional[float] = None
    stock_id: Optional[str] = None
    warehouse_name: Optional[str] = None
    product_id: Optional[int] = None
    seller: str
    created_at: datetime
    basket_id: Optional[int] = None
    available: bool = True  # True если товар в наличии, False если нет
    preferred_warehouse: bool = False


class NewPartsBasketResponse(BaseModel):
    id: int
    name: str
    is_default: bool
    items: list[CartItemResponse]
    item_count: int = 0
    total_price: float = 0


class CreateBasketRequest(BaseModel):
    """If name is empty/omitted, creates «Новые запчасти» (with numeric suffix if needed)."""
    name: Optional[str] = None


class RenameBasketRequest(BaseModel):
    name: str


class MoveNewPartsItemsRequest(BaseModel):
    item_ids: list[int]
    basket_id: int


class RefreshNewPartsOfferItem(BaseModel):
    stock_id: str
    brand: str
    partnumber: str
    delivery_start: Optional[datetime] = None
    delivery_end: Optional[datetime] = None
    price: Optional[float] = None
    purchase_price: Optional[float] = None
    supplier_unit_price: Optional[float] = None
    max_quantity: Optional[int] = None
    name: Optional[str] = None


class RefreshNewPartsOffersRequest(BaseModel):
    items: list[RefreshNewPartsOfferItem]


class CartResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    new_parts_baskets: list[NewPartsBasketResponse] = []
    new_parts_items: list[CartItemResponse]
    used_parts_items: list[CartItemResponse]


class UpdateQuantityRequest(BaseModel):
    quantity: int
