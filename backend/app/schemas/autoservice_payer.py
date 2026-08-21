from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoservicePayerView(BaseModel):
    id: int
    organization_id: str
    name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutoservicePayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class AutoservicePayerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
