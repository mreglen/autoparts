from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class SmsSettingsView(BaseModel):
    provider: str = "smsgold"
    smsc_login: str = ""
    smsc_configured: bool = False
    smsgold_user: str = ""
    smsgold_sender: str = ""
    smsgold_configured: bool = False


class SmsSettingsUpdate(BaseModel):
    provider: Optional[str] = Field(default=None, max_length=16)
    smsc_login: Optional[str] = Field(default=None, max_length=64)
    smsc_password: Optional[str] = Field(default=None, max_length=200)
    smsgold_user: Optional[str] = Field(default=None, max_length=64)
    smsgold_password: Optional[str] = Field(default=None, max_length=200)
    smsgold_sender: Optional[str] = Field(default=None, max_length=16)


class SmsMessageView(BaseModel):
    id: int
    created_at: Optional[datetime] = None
    phone: str
    text: str
    status: str
    provider: str = "smsgold"
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
