from __future__ import annotations

from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, Field


class FinanceChannelBreakdown(BaseModel):
    count: int = 0
    total: float = 0.0
    label: str = ""


class FinanceSummaryResponse(BaseModel):
    date_from: date
    date_to: date
    as_of_date: date
    sales_count: int = 0
    sales_total: float = 0.0
    sales_by_channel: dict[str, FinanceChannelBreakdown] = Field(default_factory=dict)
    writeoffs_count: int = 0
    writeoffs_qty: int = 0
    stock_in_count: int = 0
    stock_in_qty: int = 0
    stock_in_value: float = 0.0
    inventory_products: int = 0
    inventory_qty: int = 0
    inventory_value: float = 0.0
    inventory_note: str = ""


class FinanceSalesRow(BaseModel):
    id: int
    movement_date: date
    product_id: Optional[int] = None
    article: Optional[str] = None
    internal_code: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity: int
    unit_price: float
    line_total: float
    channel: str
    channel_label: str
    sale_channel: Optional[str] = None
    source_kind: Optional[str] = None
    avito_order_id: Optional[str] = None
    garage_used_order_item_id: Optional[int] = None
    reason: Optional[str] = None
    storage_location_id: Optional[int] = None


class FinanceSalesTotals(BaseModel):
    count: int = 0
    total: float = 0.0
    by_channel: dict[str, FinanceChannelBreakdown] = Field(default_factory=dict)


class FinanceSalesResponse(BaseModel):
    rows: list[FinanceSalesRow] = Field(default_factory=list)
    totals: FinanceSalesTotals


class FinanceWriteoffRow(BaseModel):
    id: int
    movement_date: date
    product_id: Optional[int] = None
    article: Optional[str] = None
    internal_code: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity: int
    sale_price: float = 0.0
    reason: Optional[str] = None
    source_kind: Optional[str] = None
    storage_location_id: Optional[int] = None


class FinanceWriteoffsResponse(BaseModel):
    rows: list[FinanceWriteoffRow] = Field(default_factory=list)
    count: int = 0
    total_qty: int = 0


class FinanceStockInRow(BaseModel):
    id: int
    created_at: date
    product_id: Optional[int] = None
    article: Optional[str] = None
    internal_code: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity: int
    unit_price: float
    line_total: float
    storage_location_id: Optional[int] = None
    creator_name: Optional[str] = None


class FinanceStockInsResponse(BaseModel):
    rows: list[FinanceStockInRow] = Field(default_factory=list)
    count: int = 0
    total_qty: int = 0
    total_value: float = 0.0


class FinanceInventoryRow(BaseModel):
    product_id: Optional[int] = None
    article: Optional[str] = None
    internal_code: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    quantity: int
    unit_price: float
    line_total: float
    stock_in_qty: int = 0
    stock_out_qty: int = 0


class FinanceInventoryResponse(BaseModel):
    rows: list[FinanceInventoryRow] = Field(default_factory=list)
    as_of_date: date
    products_count: int = 0
    total_qty: int = 0
    total_value: float = 0.0
    note: str = ""
