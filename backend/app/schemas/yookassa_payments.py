from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.rossko_settings import NewPartsOrderCreateIn


class NewPartsPaymentSessionCreateIn(NewPartsOrderCreateIn):
    """Те же поля, что и при оформлении заказа."""


class NewPartsPaymentSessionOut(BaseModel):
    session_id: str
    status: str
    amount: float
    currency: str = "RUB"
    expires_at: Optional[str] = None
    garage_order_id: Optional[int] = None
    qr_payload: Optional[str] = None
    card_confirmation_url: Optional[str] = None
    sbp_payment_status: Optional[str] = None
    card_payment_status: Optional[str] = None
    refund_status: Optional[str] = None


class CardPaymentOut(BaseModel):
    confirmation_url: Optional[str] = None
    payment_id: Optional[str] = None
