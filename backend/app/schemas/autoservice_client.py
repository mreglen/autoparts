from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


AutoserviceClientSource = Literal["self", "staff"]


class AutoserviceClientStaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)


class AutoserviceClientView(BaseModel):
    id: int
    organization_id: str
    user_id: Optional[int] = None
    name: str
    phone: str
    status: str
    source: str
    consented_at: datetime
    created_by_user_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AutoserviceClientMeResponse(BaseModel):
    is_client: bool
    client: Optional[AutoserviceClientView] = None
