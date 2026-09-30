from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class SmsGoldSettingsView(BaseModel):
    user: str = ""
    sender: str = ""
    configured: bool = False


class SmsGoldSettingsUpdate(BaseModel):
    user: str = Field(default="", max_length=64)
    password: Optional[str] = Field(default=None, max_length=200)
    sender: Optional[str] = Field(default=None, max_length=16)


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
