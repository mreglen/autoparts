from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class UsedPartsOrderStorageCellOut(BaseModel):
    id: int
    storage_cell_id: int
    value: Optional[str] = None
    storage_cell_name: Optional[str] = None


class UsedPartsOrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str
    is_paid: bool = False
    payment_method_id: Optional[int] = None
    payment_method_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    stock_out_id: Optional[int] = None
    fulfilled_at: Optional[datetime] = None
    storage_location_name: Optional[str] = None
    storage_addresses: list[str] = Field(default_factory=list)
    product_storage_cells: list[UsedPartsOrderStorageCellOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class FulfilledOrderItemOut(BaseModel):
    order_item_id: int
    stock_out_id: int
    created: bool


class UpdateUsedOrderStatusResponse(BaseModel):
    status: str = "ok"
    fulfilled_items: list[FulfilledOrderItemOut] = Field(default_factory=list)


class UsedPartsOrderResponse(BaseModel):
    id: int
    organization_id: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    buyer_comment: Optional[str] = None
    buyer_avatar_url: Optional[str] = None
    buyer_user_id: Optional[int] = None
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float
    is_paid: bool
    payment_method_id: Optional[int] = None
    payment_method_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    status_code: str
    created_at: datetime
    items: list[UsedPartsOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class MarkUsedOrderPaidRequest(BaseModel):
    payment_method_id: int


class MarkUsedOrderPaidResponse(BaseModel):
    status: str = "ok"
    is_paid: bool = False
    payment_method_id: Optional[int] = None
    payment_method_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    order_is_paid: Optional[bool] = None
    item_id: Optional[int] = None


class NewPartsOrderItemResponse(BaseModel):
    id: int
    name: str
    brand: Optional[str] = None
    partnumber: Optional[str] = None
    quantity: int
    price: float
    status_code: str
    rossko_status: Optional[str] = None
    seo_card_id: Optional[int] = None

    class Config:
        from_attributes = True


class NewPartsOrderCanViewResponse(BaseModel):
    can_view: bool


class NewPartsOrderResponse(BaseModel):
    id: int
    organization_id: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    buyer_avatar_url: Optional[str] = None
    buyer_user_id: Optional[int] = None
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    delivery_region_id: Optional[int] = None
    delivery_region_name: Optional[str] = None
    total_amount: float
    is_paid: bool
    status_code: str
    seller: Optional[str] = None
    deliver_in_parts: bool
    rossko_order_id: Optional[str] = None
    rossko_status: Optional[str] = None
    rossko_sync_error: Optional[str] = None
    created_at: datetime
    items: list[NewPartsOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class AvitoSkipReasonOut(BaseModel):
    code: str
    message: Optional[str] = None
    avito_item_id: Optional[Any] = None
    product_id: Optional[int] = None


class AvitoWarehouseFulfillmentInfo(BaseModel):
    status: str
    expected_item_count: int = 0
    stock_out_count: int = 0
    stock_out_total_amount: float = 0.0
    mismatch: bool = False
    can_retry: bool = False
    skip_reasons: list[AvitoSkipReasonOut] = Field(default_factory=list)
    last_fulfillment_at: Optional[datetime] = None


class AvitoOrderResponseV2(BaseModel):
    id: int
    organization_id: str
    avito_order_id: str
    avito_status_code: Optional[str] = None
    avito_data: Optional[dict[str, Any]] = None
    total_amount: float
    is_paid: bool
    created_at: datetime
    closed_processed: bool = False
    warehouse_fulfillment: AvitoWarehouseFulfillmentInfo

    class Config:
        from_attributes = True


class AvitoRetryWarehouseResponse(BaseModel):
    status: str = "ok"
    processed_count: int = 0
    reused_count: int = 0
    created_count: int = 0
    skipped_count: int = 0
    warehouse_fulfillment: AvitoWarehouseFulfillmentInfo


class UpdateStatusRequest(BaseModel):
    status_code: str


class VerifyPickupRequest(BaseModel):
    code: Optional[str] = None
    qr_payload: Optional[str] = None


class PickupOverrideRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


class PickupActionResponse(BaseModel):
    status: str = "ok"
    status_code: str
    order_id: int


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
    seller_user_id: Optional[int] = None
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    buyer_comment: Optional[str] = None
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    total_amount: float
    is_paid: bool
    payment_method_id: Optional[int] = None
    payment_method_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    status_code: str
    created_at: datetime
    pickup_code: Optional[str] = None
    pickup_qr_payload: Optional[str] = None
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
    seo_card_id: Optional[int] = None

    class Config:
        from_attributes = True


class PurchasedNewOrderResponse(BaseModel):
    id: int
    organization_id: str
    organization_name: Optional[str] = None
    seller_user_id: Optional[int] = None
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    delivery_type: str
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None
    delivery_region_id: Optional[int] = None
    delivery_region_name: Optional[str] = None
    total_amount: float
    is_paid: bool
    status_code: str
    seller: Optional[str] = None
    deliver_in_parts: bool
    created_at: datetime
    pickup_code: Optional[str] = None
    pickup_qr_payload: Optional[str] = None
    items: list[PurchasedNewOrderItemResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

