from __future__ import annotations

from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

RequisiteKind = Literal["individual", "ie", "legal"]

_DIGIT_LIMITS = {
    "inn_individual": 12,
    "inn_ie": 12,
    "inn_legal": 12,
    "kpp": 9,
    "ogrnip": 15,
    "ogrn": 15,
}


def _digits_only(value: object, max_len: int) -> Optional[str]:
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())[:max_len]
    return digits or None


def _text_or_none(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


class RequisiteSetsIn(BaseModel):
    person_type_default: RequisiteKind = "individual"
    ind_name: Optional[str] = Field(default=None, max_length=255)
    ie_name: Optional[str] = Field(default=None, max_length=255)
    legal_name: Optional[str] = Field(default=None, max_length=255)
    inn_individual: Optional[str] = Field(default=None, max_length=12)
    inn_ie: Optional[str] = Field(default=None, max_length=12)
    inn_legal: Optional[str] = Field(default=None, max_length=12)
    kpp: Optional[str] = Field(default=None, max_length=9)
    ogrnip: Optional[str] = Field(default=None, max_length=15)
    ogrn: Optional[str] = Field(default=None, max_length=15)
    address: Optional[str] = Field(default=None, max_length=1000)
    email: Optional[str] = Field(default=None, max_length=255)

    @field_validator(*_DIGIT_LIMITS, mode="before")
    @classmethod
    def _clean_digits(cls, value, info):
        return _digits_only(value, _DIGIT_LIMITS.get(info.field_name, 15))

    @field_validator(
        "ind_name", "ie_name", "legal_name", "address", "email", mode="before"
    )
    @classmethod
    def _clean_text(cls, value):
        return _text_or_none(value)


class RequisiteSetsView(RequisiteSetsIn):
    pass


class AutoserviceContractorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=32)
    note: Optional[str] = Field(default=None, max_length=2000)
    requisite_sets: RequisiteSetsIn = Field(default_factory=RequisiteSetsIn)

    @field_validator("name", mode="before")
    @classmethod
    def _clean_name(cls, value):
        return _text_or_none(value)


class AutoserviceContractorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=32)
    note: Optional[str] = Field(default=None, max_length=2000)
    is_active: Optional[bool] = None
    requisite_sets: Optional[RequisiteSetsIn] = None

    @field_validator("name", "phone", "note", mode="before")
    @classmethod
    def _clean_text_fields(cls, value):
        return _text_or_none(value)


class AutoserviceContractorView(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    note: Optional[str] = None
    is_active: bool
    requisite_sets: RequisiteSetsView

    model_config = {"from_attributes": True}


class AutoserviceContractorOption(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class AutoserviceContractorStats(BaseModel):
    period: str
    total: Decimal
    orders_count: int
    works_count: int
