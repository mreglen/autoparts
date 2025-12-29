from pydantic import BaseModel

class PickupLocationBase(BaseModel):
    address: str

class PickupLocationCreate(PickupLocationBase):
    organization_id: int

class PickupLocation(PickupLocationBase):
    id: int
    organization_id: int

    class Config:
        from_attributes = True