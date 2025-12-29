from pydantic import BaseModel
from typing import List, Optional
from .rossko import Delivery, Payment, Contact

class CheckoutFromCartRequest(BaseModel):
    """Запрос на оформление заказа из корзины"""
    delivery: Delivery
    payment: Payment
    contact: Contact
    delivery_parts: bool = False
    delivery_parts: bool = False

    class Config:
        from_attributes = True

class OrderFromCartResponse(BaseModel):
    """Ответ при создании заказа из корзины"""
    order_id: int
    rossko_order_ids: List[str]
    message: str

class CartAddItemRequest(BaseModel):
    """Запрос на добавление товара в корзину"""
    guid: str
    stock_id: str
    quantity: int = 1

class CartUpdateItemRequest(BaseModel):
    """Запрос на обновление количества товара в корзине"""
    quantity: int