from datetime import datetime

from pydantic import BaseModel, Field


class AutoserviceSettingsUpdate(BaseModel):
    lifts_count: int = Field(ge=0)


class AutoserviceSettingsView(BaseModel):
    id: int
    organization_id: str
    lifts_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
