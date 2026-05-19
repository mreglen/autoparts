from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class ClientBase(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    organization_id: str

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class Client(ClientBase):
    id: int

    class Config:
        from_attributes = True

class ClientResponse(BaseModel):
    id: int
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: str
    phone: str
    organization_id: str
    organization_name: Optional[str] = None

    class Config:
        from_attributes = True

    @property
    def full_name(self):
        """Return full name of the client"""
        name_parts = [self.last_name, self.first_name]
        if self.patronymic:
            name_parts.append(self.patronymic)
        return " ".join(name_parts)


class ClientListItemResponse(BaseModel):
    id: Optional[int] = None
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: str
    phone: str
    organization_id: str
    organization_name: Optional[str] = None
    orders_count: int = 0


class ClientOrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str
    order_type: str
    order_id: int


class ClientOrderGroupResponse(BaseModel):
    id: int
    order_type: str
    order_type_label: str
    status_code: str
    total_amount: float
    is_paid: bool
    created_at: datetime
    items: List[ClientOrderItemResponse] = []


class ClientBuyerOrdersResponse(BaseModel):
    buyer_name: str
    buyer_email: str
    buyer_phone: str
    orders: List[ClientOrderGroupResponse] = []