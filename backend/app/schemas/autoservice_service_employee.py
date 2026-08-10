from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


SALARY_TYPES = ("fixed", "percent_work", "daily_rate")


class AutoserviceServiceEmployeeView(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    position: Optional[str] = None
    salary_type: str
    salary_amount: Decimal
    work_percent: Decimal
    is_active: bool

    model_config = {"from_attributes": True}


class AutoserviceServiceEmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: Optional[str] = Field(None, max_length=32)
    position: Optional[str] = Field(None, max_length=80)
    salary_type: Literal["fixed", "percent_work", "daily_rate"] = "percent_work"
    salary_amount: Decimal = Field(default=Decimal("0"), ge=0)
    work_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class AutoserviceServiceEmployeeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    phone: Optional[str] = Field(None, max_length=32)
    position: Optional[str] = Field(None, max_length=80)
    salary_type: Optional[Literal["fixed", "percent_work", "daily_rate"]] = None
    salary_amount: Optional[Decimal] = Field(None, ge=0)
    work_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class AutoserviceServiceEmployeeBulkPercent(BaseModel):
    work_percent: Decimal = Field(ge=0, le=100)


class AutoserviceEmployeePayrollStats(BaseModel):
    period: str
    total: Decimal
    from_works: Decimal
    from_daily: Decimal
    from_fixed: Decimal
    completed_orders: int
