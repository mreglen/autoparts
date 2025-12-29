from datetime import date
from pydantic import BaseModel
from typing import List, Optional


class SearchRequest(BaseModel):
    text: str
    delivery_id: str = "000000001"
    address_id: Optional[int] = 176458

class Delivery(BaseModel):
    delivery_id: str = "000000001"
    address_id: Optional[int] = 176458


class Payment(BaseModel):
    payment_id: int = 2
    requisite_id: Optional[int] = None


class Contact(BaseModel):
    name: str = 'Илья'
    phone: str = '89959356025'
    comment: Optional[str] = 'Тестовый заказ с сайта для росско'


class Part(BaseModel):
    partnumber: str
    brand: str
    stock: str
    count: int
    comment: Optional[str] = None


class CheckoutRequest(BaseModel):
    delivery: Delivery
    payment: Payment
    contact: Contact
    delivery_parts: bool = False
    parts: List[Part]


class OrderIds(BaseModel):
    id: List[int]


class GetOrdersRequest(BaseModel):
    # обязательно всегда
    # KEY1 и KEY2 берутся из Settings, сюда не передаем

    order_ids: Optional[OrderIds] = None

    limit: Optional[int] = None
    type: Optional[int] = None  # 1-4

    start_date: Optional[date] = None
    end_date: Optional[date] = None