from pydantic import BaseModel
from typing import Optional


class DeliveryMethodBase(BaseModel):
    name: str
    description: Optional[str] = None


class DeliveryMethodCreate(DeliveryMethodBase):
    pass


class DeliveryMethodResponse(DeliveryMethodBase):
    id: int

    class Config:
        from_attributes = True


class OrganizationDeliveryMethodResponse(BaseModel):
    id: int
    organization_id: str
    delivery_method_id: int

    class Config:
        from_attributes = True