from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class AutoserviceWorkView(BaseModel):
    id: int
    name: str
    default_unit_price: Decimal
    sort_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class AutoserviceWorkCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    default_unit_price: Decimal = Field(default=Decimal("0"), ge=0)


class AutoserviceWorkUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    default_unit_price: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None
