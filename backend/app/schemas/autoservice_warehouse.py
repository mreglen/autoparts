from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AutoserviceWarehouseItemView(BaseModel):
    id: int
    brand: str
    article: str
    name: str
    quantity: int
    reserved_qty: int
    available_qty: int
    unit_price: Decimal

    model_config = {"from_attributes": True}


class AutoserviceWarehouseReceiptView(BaseModel):
    id: int
    item_id: int
    brand: str
    article: str
    name: str
    quantity: int
    unit_price: Decimal
    cart_item_type: Optional[str] = None
    cart_item_id: Optional[int] = None
    repair_order_id: Optional[int] = None
    created_at: date
    creator_name: Optional[str] = None


class AutoserviceWarehouseExpenseView(BaseModel):
    id: int
    item_id: int
    brand: str
    article: str
    name: str
    quantity: int
    unit_price: Decimal
    reason: Optional[str] = None
    created_at: date
    creator_name: Optional[str] = None


class PurchaseWarehouseImportGroup(BaseModel):
    order_type: Literal["new", "used"]
    item_ids: list[int] = Field(min_length=1)


class PurchaseWarehouseImportIn(BaseModel):
    groups: list[PurchaseWarehouseImportGroup] = Field(min_length=1)


class AutoserviceWarehouseExpenseCreate(BaseModel):
    item_id: int
    quantity: int = Field(ge=1)
    reason: Optional[str] = Field(None, max_length=255)


class AutoserviceWarehouseImportResult(BaseModel):
    added_items: int
    skipped_items: int
