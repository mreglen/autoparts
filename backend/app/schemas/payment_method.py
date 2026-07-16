from pydantic import BaseModel
from typing import Optional


class PaymentMethodBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


class PaymentMethodCreate(PaymentMethodBase):
    pass


class PaymentMethodResponse(PaymentMethodBase):
    id: int

    class Config:
        from_attributes = True


class OrganizationPaymentMethodResponse(BaseModel):
    id: int
    organization_id: str
    payment_method_id: int

    class Config:
        from_attributes = True
