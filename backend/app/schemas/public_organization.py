from pydantic import BaseModel
from typing import Optional


class PublicOrganizationListItem(BaseModel):
    id: str
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    logo_organization: Optional[str] = None
    description: Optional[str] = None
    products_count: int = 0
    members_count: int = 0

    class Config:
        from_attributes = True


class PublicOrganizationDetail(PublicOrganizationListItem):
    pass
