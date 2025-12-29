from pydantic import BaseModel
from typing import List, Optional

class OrganizationBase(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None

class Organization(OrganizationBase):
    id: str

    class Config:
        from_attributes = True