from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoserviceLiftView(BaseModel):
    id: int
    organization_id: str
    name: str
    sort_order: int
    is_active: bool
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutoserviceLiftBrief(BaseModel):
    id: int
    name: str
    sort_order: int


class AutoserviceLiftCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)


class AutoserviceLiftUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AutoserviceLiftStatsOrder(BaseModel):
    id: int
    order_number: str
    status: str
    scheduled_at: datetime
    scheduled_end_at: Optional[datetime] = None
    client_name: str
    vehicle: str


class AutoserviceLiftStats(BaseModel):
    lift_id: int
    name: str
    total_orders: int
    orders_by_status: dict[str, int] = Field(default_factory=dict)
    busy_dates: list[date] = Field(default_factory=list)
    total_hours: float = 0.0
    orders_without_end_time: int = 0
    recent_orders: list[AutoserviceLiftStatsOrder] = Field(default_factory=list)
