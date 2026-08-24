from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoserviceWorkZoneView(BaseModel):
    id: int
    organization_id: str
    name: str
    sort_order: int
    is_active: bool
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutoserviceWorkZoneBrief(BaseModel):
    id: int
    name: str
    sort_order: int


class AutoserviceWorkZoneCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=120)


class AutoserviceWorkZoneUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class AutoserviceWorkZoneReorder(BaseModel):
    zone_ids: list[int] = Field(min_length=1)
