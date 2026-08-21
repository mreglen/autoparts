from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

AutoservicePayerPersonType = Literal["individual", "ie", "legal"]


class AutoservicePayerView(BaseModel):
    id: int
    organization_id: str
    name: str
    display_name: str = ""
    email: Optional[str] = None
    person_type: str = "individual"
    legal_name: Optional[str] = None
    address: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AutoservicePayerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    person_type: AutoservicePayerPersonType = "individual"
    legal_name: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = None
    inn: Optional[str] = Field(default=None, max_length=20)
    kpp: Optional[str] = Field(default=None, max_length=20)
    ogrn: Optional[str] = Field(default=None, max_length=20)


class AutoservicePayerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    person_type: AutoservicePayerPersonType = "individual"
    legal_name: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = None
    inn: Optional[str] = Field(default=None, max_length=20)
    kpp: Optional[str] = Field(default=None, max_length=20)
    ogrn: Optional[str] = Field(default=None, max_length=20)
