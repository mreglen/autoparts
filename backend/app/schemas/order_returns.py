from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

ReturnReason = Literal["defect", "wrong_item", "not_as_described", "changed_mind", "other"]
ReturnStatus = Literal[
    "requested",
    "reviewing",
    "approved",
    "rejected",
    "received",
    "refunded",
    "closed",
]

MAX_RETURN_ATTACHMENTS = 5


class OrderReturnAttachmentOut(BaseModel):
    id: int
    file_url: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrderReturnCreate(BaseModel):
    order_id: int
    reason: ReturnReason
    comment: Optional[str] = None
    photo_urls: list[str] = Field(default_factory=list, max_length=MAX_RETURN_ATTACHMENTS)


class OrderReturnStatusUpdate(BaseModel):
    status_code: ReturnStatus
    seller_note: Optional[str] = None


class OrderReturnOrderItemOut(BaseModel):
    id: int
    name: str
    quantity: int
    price: float
    product_id: Optional[int] = None


class OrderReturnOrderSnapshot(BaseModel):
    id: int
    organization_name: str
    buyer_name: str
    buyer_phone: str
    buyer_email: str
    total_amount: float
    status_code: str
    created_at: datetime
    items: list[OrderReturnOrderItemOut]


class OrderReturnOut(BaseModel):
    id: int
    organization_id: str
    order_id: int
    buyer_user_id: Optional[int] = None
    reason: str
    comment: Optional[str] = None
    status_code: str
    seller_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    status_changed_at: datetime
    attachments: list[OrderReturnAttachmentOut] = Field(default_factory=list)
    order: Optional[OrderReturnOrderSnapshot] = None

    class Config:
        from_attributes = True


class AvitoAcceptReturnRequest(BaseModel):
    terminal_number: str
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None


class AvitoReturnOrderOut(BaseModel):
    id: int
    avito_order_id: str
    avito_status_code: Optional[str] = None
    total_amount: float
    created_at: datetime
    avito_data: Optional[dict] = None
