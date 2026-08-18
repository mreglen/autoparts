from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


AutoserviceClientSource = Literal["self", "staff"]
AutoserviceClientPersonType = Literal["individual", "ie", "legal"]


class AutoserviceClientStaffCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=40)


class AutoserviceClientStaffUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, min_length=5, max_length=40)
    email: Optional[EmailStr] = None
    person_type: Optional[AutoserviceClientPersonType] = None
    legal_name: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = None
    inn: Optional[str] = Field(default=None, max_length=20)
    kpp: Optional[str] = Field(default=None, max_length=20)
    ogrn: Optional[str] = Field(default=None, max_length=20)


class AutoserviceClientView(BaseModel):
    id: int
    organization_id: str
    user_id: Optional[int] = None
    name: str
    phone: str
    email: Optional[str] = None
    person_type: str = "individual"
    legal_name: Optional[str] = None
    address: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    status: str
    source: str
    consented_at: datetime
    created_by_user_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AutoserviceClientMeResponse(BaseModel):
    is_client: bool
    client: Optional[AutoserviceClientView] = None


class AutoserviceClientCreateAccountResponse(BaseModel):
    client: AutoserviceClientView
    user_id: int
    email: str
    email_sent: bool
    status: Literal["created_and_linked"] = "created_and_linked"
