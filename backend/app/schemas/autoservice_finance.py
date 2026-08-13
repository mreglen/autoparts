from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

AutoservicePaymentMethod = Literal["card", "cash", "bank"]


class AutoservicePaymentIn(BaseModel):
    method: AutoservicePaymentMethod
    amount: Decimal = Field(gt=0)


class AutoservicePaymentMethodTotals(BaseModel):
    card: Decimal = Decimal("0.00")
    cash: Decimal = Decimal("0.00")
    bank: Decimal = Decimal("0.00")


class AutoserviceFinanceReceiptRow(BaseModel):
    sequential_number: int
    repair_order_id: int
    repair_order_number: str
    client_name: str
    amount: Decimal
    method: AutoservicePaymentMethod
    created_at: datetime


class AutoserviceFinanceReceiptsResponse(BaseModel):
    totals: AutoservicePaymentMethodTotals
    total_amount: Decimal = Decimal("0.00")
    count: int = 0
    items: list[AutoserviceFinanceReceiptRow] = Field(default_factory=list)
