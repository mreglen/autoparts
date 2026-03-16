from pydantic import BaseModel
from typing import List, Optional

class OrganizationBase(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    logo_organization: Optional[str] = None
    description: Optional[str] = None
    watermark: Optional[int] = 1  # 1=my garage (default), 0=none, 2=my organization

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    logo_organization: Optional[str] = None
    description: Optional[str] = None
    watermark: Optional[int] = None

class Organization(OrganizationBase):
    id: str

    class Config:
        from_attributes = True