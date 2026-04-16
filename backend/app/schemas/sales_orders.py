from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class UsedPartsOrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str

    class Config:
        from_attributes = True


class UsedPartsOrderResponse(BaseModel):
    id: int
    organization_id: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float
    is_paid: bool
    status_code: str
    created_at: datetime
    items: list[UsedPartsOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class NewPartsOrderItemResponse(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str

    class Config:
        from_attributes = True


class NewPartsOrderResponse(BaseModel):
    id: int
    organization_id: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float
    is_paid: bool
    status_code: str
    seller: Optional[str] = None
    deliver_in_parts: bool
    created_at: datetime
    items: list[NewPartsOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class AvitoOrderResponseV2(BaseModel):
    id: int
    organization_id: str
    avito_order_id: str
    avito_status_code: Optional[str] = None
    avito_data: Optional[dict[str, Any]] = None
    total_amount: float
    is_paid: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateStatusRequest(BaseModel):
    status_code: str


class PurchasedUsedOrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str

    class Config:
        from_attributes = True


class PurchasedUsedOrderResponse(BaseModel):
    id: int
    organization_id: str
    organization_name: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float
    is_paid: bool
    status_code: str
    created_at: datetime
    items: list[PurchasedUsedOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PurchasedNewOrderItemResponse(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str

    class Config:
        from_attributes = True


class PurchasedNewOrderResponse(BaseModel):
    id: int
    organization_id: str
    organization_name: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float
    is_paid: bool
    status_code: str
    seller: Optional[str] = None
    deliver_in_parts: bool
    created_at: datetime
    items: list[PurchasedNewOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

