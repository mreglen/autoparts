from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class AutoserviceWarehouseItemView(BaseModel):
    id: int
    brand: str
    article: str
    name: str
    quantity: int
    reserved_qty: int
    available_qty: int
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal

    model_config = {"from_attributes": True}


class AutoserviceWarehouseItemUpdate(BaseModel):
    brand: str = Field("", max_length=120)
    article: str = Field("", max_length=120)
    name: str = Field(min_length=1, max_length=255)
    unit: Literal["pcs", "l", "kg"] = "pcs"


class AutoserviceWarehouseReceiptView(BaseModel):
    id: int
    item_id: int
    brand: str
    article: str
    name: str
    quantity: int
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal
    line_total: Decimal
    cart_item_type: Optional[str] = None
    cart_item_id: Optional[int] = None
    repair_order_id: Optional[int] = None
    created_at: date
    creator_name: Optional[str] = None
    can_edit_price: bool = False
    can_edit_unit: bool = False
    client_unit_price_override: Optional[Decimal] = None
    markup_percent: Optional[Decimal] = None
    automatic_client_unit_price: Optional[Decimal] = None


class AutoserviceWarehouseReceiptLinePriceUpdate(BaseModel):
    unit_price: Optional[Decimal] = Field(default=None, ge=0)
    client_unit_price_override: Optional[Decimal] = Field(default=None, ge=0)
    clear_client_unit_price_override: bool = False
    unit: Optional[Literal["pcs", "l", "kg"]] = None


class AutoserviceWarehouseReceiptLineUpdate(BaseModel):
    brand: str = Field("", max_length=120)
    article: str = Field("", max_length=120)
    name: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0)
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal = Field(ge=0)


class AutoserviceWarehouseReceiptDocListView(BaseModel):
    id: int
    number: str
    doc_date: date
    supplier_kind: str
    supplier_name: str
    total_amount: Decimal
    lines_count: int
    repair_order_id: Optional[int] = None
    repair_order_number: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime


class AutoserviceWarehouseReceiptDocDetailView(BaseModel):
    id: int
    number: str
    doc_date: date
    supplier_kind: str
    supplier_name: str
    total_amount: Decimal
    lines_count: int
    repair_order_id: Optional[int] = None
    repair_order_number: Optional[str] = None
    creator_name: Optional[str] = None
    created_at: datetime
    lines: list[AutoserviceWarehouseReceiptView]


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


class AutoserviceWarehouseManualReceiptIn(BaseModel):
    brand: str = Field("", max_length=120)
    article: str = Field("", max_length=120)
    name: str = Field(min_length=1, max_length=255)
    quantity: Decimal = Field(gt=0)
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal = Field(ge=0)

    @field_validator("quantity", mode="before")
    @classmethod
    def _parse_quantity(cls, value):
        if value is None or value == "":
            raise ValueError("Укажите количество")
        return Decimal(str(value))


class AutoserviceWarehouseImportResult(BaseModel):
    added_items: int
    skipped_items: int
    not_found_items: int = 0


class AutoserviceWarehouseReceiptSuggestView(BaseModel):
    brand: str
    article: str
    name: str
    unit_price: Decimal
