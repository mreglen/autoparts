from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoserviceSettingsUpdate(BaseModel):
    public_name: Optional[str] = Field(None, max_length=160)
    public_description: Optional[str] = Field(None, max_length=2000)


class AutoserviceSettingsView(BaseModel):
    id: int
    organization_id: str
    public_name: Optional[str] = None
    public_description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutoservicePublicInfo(BaseModel):
    """Public autoservice card used by the client welcome page."""

    enabled: bool
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
