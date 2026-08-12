from pydantic import BaseModel
from typing import List, Optional

class OrganizationBase(BaseModel):
    name: str
    address: str
    phone: Optional[str] = None
    logo_organization: Optional[str] = None
    description: Optional[str] = None
    watermark: Optional[int] = 1  # 1=my garage (default), 0=none, 2=my organization
    new_parts_markup_percent: Optional[float] = None
    new_parts_markup_manual: Optional[bool] = False
    append_marketplace_site_info: Optional[bool] = False
    is_autoservice: Optional[bool] = False
    autoservice_paused: Optional[bool] = False

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    logo_organization: Optional[str] = None
    description: Optional[str] = None
    watermark: Optional[int] = None
    new_parts_markup_percent: Optional[float] = None
    new_parts_markup_manual: Optional[bool] = None
    append_marketplace_site_info: Optional[bool] = None
    is_autoservice: Optional[bool] = None
    autoservice_paused: Optional[bool] = None

class Organization(OrganizationBase):
    id: str

    class Config:
        from_attributes = True