from pydantic import BaseModel
from typing import Optional


class PublicOrganizationListItem(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    logo_organization: Optional[str] = None
    description: Optional[str] = None
    has_catalog_items: bool = False

    class Config:
        from_attributes = True


class PublicOrganizationDetail(PublicOrganizationListItem):
    pass


class PublicOrganizationBrandSummary(BaseModel):
    name: str
    slug: str
    count: int


class PublicOrganizationCatalogSummary(BaseModel):
    total_count: int
    brands: list[PublicOrganizationBrandSummary]
