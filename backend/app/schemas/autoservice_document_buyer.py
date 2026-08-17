from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AutoserviceDocumentBuyerBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    address: Optional[str] = None
    inn: Optional[str] = Field(None, max_length=12)
    kpp: Optional[str] = Field(None, max_length=9)


class AutoserviceDocumentBuyerCreate(AutoserviceDocumentBuyerBase):
    pass


class AutoserviceDocumentBuyerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    address: Optional[str] = None
    inn: Optional[str] = Field(None, max_length=12)
    kpp: Optional[str] = Field(None, max_length=9)


class AutoserviceDocumentBuyerView(AutoserviceDocumentBuyerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
