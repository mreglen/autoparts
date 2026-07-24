from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


class SitePaymentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    start_date: date
    end_date: Optional[date] = None
    duration_days: Optional[int] = Field(None, ge=1)
    monthly_amount: Decimal = Field(..., gt=0)
    comment: Optional[str] = None

    @model_validator(mode="after")
    def require_end_or_days(self):
        if self.end_date is None and self.duration_days is None:
            raise ValueError("Укажите дату конца услуги или количество дней")
        if self.end_date is not None and self.duration_days is not None:
            # Both allowed — end_date wins; duration will be recalculated server-side
            pass
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("Дата конца не может быть раньше даты начала")
        return self


class SitePaymentPay(BaseModel):
    amount: Decimal = Field(..., gt=0)
    note: Optional[str] = None


class SitePaymentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: Optional[int] = Field(None, ge=1)
    monthly_amount: Optional[Decimal] = Field(None, gt=0)
    comment: Optional[str] = None

    @model_validator(mode="after")
    def validate_period(self):
        if self.end_date is not None and self.start_date is not None and self.end_date < self.start_date:
            raise ValueError("Дата конца не может быть раньше даты начала")
        return self


class SitePaymentLedgerView(BaseModel):
    id: int
    amount: Decimal
    note: Optional[str] = None
    created_by_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SitePaymentView(BaseModel):
    id: int
    title: str
    start_date: date
    end_date: date
    duration_days: int
    monthly_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    remaining_amount: Decimal
    comment: Optional[str] = None
    status: str
    created_by_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    ledger: List[SitePaymentLedgerView] = Field(default_factory=list)

    class Config:
        from_attributes = True


SitePaymentScope = Literal["active", "history"]
