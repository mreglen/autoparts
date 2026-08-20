from __future__ import annotations

from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class OrganizationEmployeeCardView(BaseModel):
    id: int
    organization_id: str
    user_id: Optional[int] = None
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    position: Optional[str] = None
    comment: Optional[str] = None
    is_service_executor: bool = False
    is_active: bool = True
    account_status: str = "no_account"
    is_director: bool = False
    salary_type: Optional[str] = None
    salary_amount: Optional[Decimal] = None
    work_percent: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class OrganizationEmployeeCardCreate(BaseModel):
    last_name: str = Field(min_length=1, max_length=100)
    first_name: str = Field(min_length=1, max_length=100)
    patronymic: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[EmailStr] = None
    position: Optional[str] = Field(None, max_length=80)
    comment: Optional[str] = None
    is_service_executor: bool = False
    salary_type: Literal["percent_work", "fixed"] = "percent_work"
    salary_amount: Decimal = Field(default=Decimal("0"), ge=0)
    work_percent: Decimal = Field(default=Decimal("50"), ge=0, le=100)


class OrganizationEmployeeCardUpdate(BaseModel):
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    patronymic: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[EmailStr] = None
    position: Optional[str] = Field(None, max_length=80)
    comment: Optional[str] = None
    is_service_executor: Optional[bool] = None
    salary_type: Optional[Literal["percent_work", "fixed"]] = None
    salary_amount: Optional[Decimal] = Field(None, ge=0)
    work_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class OrganizationEmployeeCreateAccountResponse(BaseModel):
    ok: bool = True
    user_id: int
    email_sent: bool = False
    message: str = "Аккаунт создан"


class OrganizationEmployeeCardPermissionsRequest(BaseModel):
    permission_ids: list[int] = Field(default_factory=list)
