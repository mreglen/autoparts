from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class RosskoOptionItem(BaseModel):
    id: str
    label: str
    raw: Optional[dict] = None


class RosskoDeliveryOption(BaseModel):
    id: str
    label: str
    is_pickup: bool = False
    requires_address: bool = True
    raw: Optional[dict] = None


class RosskoPaymentOption(BaseModel):
    id: int
    label: str
    is_card: bool = False
    requires_requisite: bool = False
    raw: Optional[dict] = None


class RosskoCheckoutDetailsResponse(BaseModel):
    deliveries: list[RosskoDeliveryOption] = Field(default_factory=list)
    addresses: list[RosskoOptionItem] = Field(default_factory=list)
    payments: list[RosskoPaymentOption] = Field(default_factory=list)
    requisites: list[RosskoOptionItem] = Field(default_factory=list)
    raw: Optional[dict] = None


class RosskoSettingsResponse(BaseModel):
    delivery_id: Optional[str] = None
    address_id: Optional[str] = None
    payment_id: Optional[int] = None
    requisite_id: Optional[int] = None
    contact_name: str = ""
    contact_phone: str = ""
    default_comment: Optional[str] = None
    delivery_parts: bool = False
    delivery_name: Optional[str] = None
    address_label: Optional[str] = None
    payment_name: Optional[str] = None
    requisite_name: Optional[str] = None
    is_pickup: Optional[bool] = None
    requires_address: Optional[bool] = None
    requires_requisite: Optional[bool] = None
    configured: bool = False
    updated_at: Optional[datetime] = None
    allow_unpaid_checkout: bool = False


class RosskoSettingsUpdate(BaseModel):
    delivery_id: str
    address_id: Optional[str] = None
    payment_id: int
    requisite_id: Optional[int] = None
    contact_name: str
    contact_phone: str
    default_comment: Optional[str] = None
    delivery_parts: bool = False
    delivery_name: Optional[str] = None
    address_label: Optional[str] = None
    payment_name: Optional[str] = None
    requisite_name: Optional[str] = None
    is_pickup: Optional[bool] = None
    requires_address: Optional[bool] = None
    requires_requisite: Optional[bool] = None


class RosskoMarkupSettingsResponse(BaseModel):
    buyer_markup_percent: float = 30.0
    seller_markup_percent: float = 15.0
    autoservice_markup_percent: float = 7.0


class RosskoMarkupSettingsUpdate(BaseModel):
    buyer_markup_percent: float = Field(..., ge=0, le=500)
    seller_markup_percent: float = Field(..., ge=0, le=500)
    autoservice_markup_percent: float = Field(..., ge=0, le=500)


class NewPartsOrderCreateIn(BaseModel):
    recipient_name: str = ""
    recipient_phone: str = ""
    recipient_email: str = ""
    delivery_type: str = "transport"
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    delivery_region_id: Optional[int] = None
    delivery_region_name: Optional[str] = None
    delivery_option_id: Optional[int] = None
    comment: Optional[str] = None
    deliver_in_parts: bool = False
    basket_id: Optional[int] = None


class NewPartsOrderCreateOut(BaseModel):
    ok: bool = True
    order_id: int
    message: Optional[str] = None
