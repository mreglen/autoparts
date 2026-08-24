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
    return_reserved_qty: int = 0
    available_qty: int
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal

    model_config = {"from_attributes": True}


class AutoserviceWarehouseItemReservationView(BaseModel):
    repair_order_id: int
    repair_order_number: Optional[str] = None
    order_status: str
    qty: Decimal
    unit: Literal["pcs", "l", "kg"] = "pcs"


class AutoserviceWarehouseItemUpdate(BaseModel):
    brand: str = Field("", max_length=120)
    article: str = Field("", max_length=120)
    name: str = Field(min_length=1, max_length=255)
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal = Field(ge=0)


class AutoserviceWarehouseReceiptView(BaseModel):
    id: int
    item_id: int
    brand: str
    article: str
    name: str
    quantity: int
    return_reserved_qty: int = 0
    returned_qty: int = 0
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


class AutoserviceWarehouseReceiptDocUpdate(BaseModel):
    doc_date: date


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


WarehouseReturnReason = Literal[
    "defect",
    "wrong_item",
    "not_as_described",
    "changed_mind",
    "other",
]


class AutoserviceWarehouseReturnCreate(BaseModel):
    receipt_id: int
    quantity: int = Field(ge=1)
    reason: WarehouseReturnReason
    comment: Optional[str] = Field(default=None, max_length=4000)
    photo_urls: list[str] = Field(default_factory=list, max_length=5)


class AutoserviceWarehouseReturnStatusUpdate(BaseModel):
    status_code: Literal[
        "reviewing",
        "approved",
        "rejected",
        "cancelled",
        "sent",
        "refunded",
        "closed",
    ]
    seller_note: Optional[str] = Field(default=None, max_length=4000)


class AutoserviceWarehouseReturnView(BaseModel):
    id: int
    organization_id: str
    supplier_organization_id: Optional[str] = None
    receipt_id: int
    item_id: int
    source_order_type: str
    source_order_id: int
    cart_item_type: str
    cart_item_id: int
    provider_kind: str
    processing_mode: str
    supplier_name: str
    brand: str
    article: str
    name: str
    quantity: int
    unit_price: Decimal
    reason: str
    comment: Optional[str] = None
    photo_urls: list[str] = Field(default_factory=list)
    status_code: str
    seller_note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    status_changed_at: datetime


class AutoserviceWarehousePurchaseLotView(BaseModel):
    receipt_id: int
    document_id: Optional[int] = None
    item_id: int
    source_order_type: str
    source_order_id: int
    cart_item_type: str
    cart_item_id: int
    supplier_name: str
    provider_kind: str
    brand: str
    article: str
    name: str
    unit: Literal["pcs", "l", "kg"] = "pcs"
    quantity: int
    returned_qty: int
    return_reserved_qty: int
    item_quantity: int
    item_reserved_qty: int
    item_return_reserved_qty: int
    max_returnable_qty: int
    unit_price: Decimal
    created_at: date
    active_return: Optional[AutoserviceWarehouseReturnView] = None


class WarehouseStockReportRow(BaseModel):
    id: int
    brand: str = ""
    article: str = ""
    name: str = ""
    unit: Literal["pcs", "l", "kg"] = "pcs"
    unit_price: Decimal = Decimal("0.00")
    opening_qty: int = 0
    received_qty: int = 0
    expensed_qty: int = 0
    closing_qty: int = 0
    reserved_qty: Optional[int] = None
    return_reserved_qty: Optional[int] = None
    available_qty: Optional[int] = None
    stock_amount: Decimal = Decimal("0.00")


class WarehouseStockReportSummary(BaseModel):
    positions: int = 0
    closing_value: Decimal = Decimal("0.00")
    opening_value: Decimal = Decimal("0.00")
    received_qty: int = 0
    expensed_qty: int = 0


class WarehouseStockReportResponse(BaseModel):
    year: int
    month: int
    as_of: date
    is_current_month: bool
    summary: WarehouseStockReportSummary
    items: list[WarehouseStockReportRow] = Field(default_factory=list)
