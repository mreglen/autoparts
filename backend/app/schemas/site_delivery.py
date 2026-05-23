from __future__ import annotations

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


DELIVERY_TYPES = {"pickup", "pvz", "courier"}


class SiteDeliveryOptionBase(BaseModel):
    region_id: int = Field(..., ge=1)
    region_name: str = Field(..., min_length=1, max_length=255)
    delivery_type: str = Field(..., min_length=2, max_length=32)
    carrier: Optional[str] = Field(None, max_length=255)
    pickup_point: Optional[str] = None
    min_order_amount: Decimal = Field(default=Decimal("0"), ge=0)
    enabled: bool = True
    sort_order: int = Field(default=0, ge=0)
    notes: Optional[str] = None


class SiteDeliveryOptionCreate(SiteDeliveryOptionBase):
    pass


class SiteDeliveryOptionUpdate(BaseModel):
    region_id: Optional[int] = Field(None, ge=1)
    region_name: Optional[str] = Field(None, min_length=1, max_length=255)
    delivery_type: Optional[str] = Field(None, min_length=2, max_length=32)
    carrier: Optional[str] = Field(None, max_length=255)
    pickup_point: Optional[str] = None
    min_order_amount: Optional[Decimal] = Field(None, ge=0)
    enabled: Optional[bool] = None
    sort_order: Optional[int] = Field(None, ge=0)
    notes: Optional[str] = None


class SiteDeliveryOptionView(SiteDeliveryOptionBase):
    id: int

    class Config:
        from_attributes = True


class SitePaymentInfoView(BaseModel):
    methods: list[str]
    notes: str
