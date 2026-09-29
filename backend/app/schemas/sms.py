from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class SmscSettingsView(BaseModel):
    login: str = ""
    configured: bool = False


class SmscSettingsUpdate(BaseModel):
    login: str = Field(default="", max_length=64)
    password: Optional[str] = Field(default=None, max_length=200)


class SmsMessageView(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    phone: str
    text: str
    status: str
    cost: Optional[Decimal] = None
    error_message: Optional[str] = None
    organization_id: Optional[str] = None

    class Config:
        from_attributes = True


class SmsHistoryResponse(BaseModel):
    items: list[SmsMessageView]
    count: int
    total_cost: Decimal


class SmsSendResult(BaseModel):
    status: str
    cost: Optional[Decimal] = None
    error_message: Optional[str] = None
