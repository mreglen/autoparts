from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


InventoryScopeType = Literal["location_all", "cells", "products"]
InventorySessionStatus = Literal["draft", "counting", "completed", "cancelled"]
InventoryLineStatus = Literal["pending", "counted", "skipped"]
AdjustmentKind = Literal["match", "surplus", "shortage"]


class InventorySessionCreate(BaseModel):
    storage_location_id: int
    scope_type: InventoryScopeType = "location_all"
    scope_cell_ids: list[int] = Field(default_factory=list)
    scope_product_ids: list[int] = Field(default_factory=list)
    title: Optional[str] = None
    notes: Optional[str] = None


class InventoryCountLineUpdate(BaseModel):
    counted_qty: Optional[int] = None
    line_status: Optional[InventoryLineStatus] = None


class InventoryCountLineBulkItem(BaseModel):
    line_id: int
    counted_qty: Optional[int] = None
    line_status: Optional[InventoryLineStatus] = None


class InventoryCountLineBulkUpdate(BaseModel):
    lines: list[InventoryCountLineBulkItem]


class InventoryCountLineResponse(BaseModel):
    id: int
    product_id: int
    storage_location_id: int
    storage_cell_id: Optional[int] = None
    expected_qty: int
    counted_qty: Optional[int] = None
    line_status: str
    product_article: Optional[str] = None
    product_name: Optional[str] = None
    product_brand: Optional[str] = None

    class Config:
        from_attributes = True


class InventorySessionResponse(BaseModel):
    id: int
    organization_id: str
    storage_location_id: int
    storage_location_address: Optional[str] = None
    status: str
    scope_type: str
    scope_cell_ids: list[int] = Field(default_factory=list)
    scope_product_ids: list[int] = Field(default_factory=list)
    title: Optional[str] = None
    notes: Optional[str] = None
    created_by: int
    completed_by: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    count_lines: list[InventoryCountLineResponse] = Field(default_factory=list)
    lines_total: int = 0
    lines_counted: int = 0
    lines_pending: int = 0

    class Config:
        from_attributes = True


class InventorySessionListItem(BaseModel):
    id: int
    storage_location_id: int
    storage_location_address: Optional[str] = None
    status: str
    scope_type: str
    title: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    lines_total: int = 0
    lines_counted: int = 0


class InventoryAdjustmentReportRow(BaseModel):
    line_id: int
    product_id: int
    product_article: Optional[str] = None
    product_name: Optional[str] = None
    expected_qty: int
    counted_qty: int
    delta_qty: int
    adjustment_kind: AdjustmentKind


class InventoryAdjustmentReport(BaseModel):
    session_id: int
    status: str
    rows: list[InventoryAdjustmentReportRow] = Field(default_factory=list)
    totals: dict = Field(default_factory=dict)
    can_complete: bool = False
    blocking_reason: Optional[str] = None


class InventoryCompleteRequest(BaseModel):
    apply_adjustments: bool = True
    notes: Optional[str] = None


class InventoryCompleteResponse(BaseModel):
    session_id: int
    status: str
    adjustments_applied: int
    stock_ins_created: int
    stock_outs_created: int
    matches: int
