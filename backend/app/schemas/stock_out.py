from typing import Optional
from pydantic import BaseModel
from datetime import date
from .product import Product
from .storage_location import StorageLocation
from .user import User  

class StockOutBase(BaseModel):
    quantity: int
    sale_price: float
    movement_date: date
    reason: Optional[str] = None
    sale_channel: Optional[str] = None
    avito_order_id: Optional[str] = None
    source_kind: Optional[str] = None

class StockOutCreate(StockOutBase):
    organization_id: str
    storage_location_id: int
    product_id: int
    acquired_product_id: Optional[int] = None
    user_id: int

class StockOut(StockOutBase):
    id: int
    organization_id: str
    storage_location_id: int
    product_id: int
    acquired_product_id: Optional[int] = None
    user_id: Optional[int] = None
    sale_channel: Optional[str] = None
    avito_order_id: Optional[str] = None
    source_kind: Optional[str] = None
    garage_used_order_item_id: Optional[int] = None

    product: Optional[Product] = None
    storage_location: Optional[StorageLocation] = None
    user: Optional[User] = None

    class Config:
        from_attributes = True


class ReturnItem(BaseModel):
    stockOutId: int
    productId: int
    quantity: int
    returnPrice: float
    reason: Optional[str] = None
    storageLocationId: int

    class Config:
        validate_by_name = True
        # Разрешаем дополнительные поля, которые могут прийти
        extra = "ignore"
        # Преобразовываем поля из snake_case в camelCase и наоборот
        alias_generator = lambda x: x  # Сохраняем как есть


class ReturnCreate(BaseModel):
    items: list[ReturnItem]