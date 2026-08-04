from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class CatalogSoftBase(BaseModel):
    ok: bool
    reason: Literal["ok", "not_found", "temporarily_unavailable", "session_expired"]
    message: Optional[str] = None


class CatalogFeaturesResponse(CatalogSoftBase):
    catalog: Optional[str] = None
    features: list[str] = Field(default_factory=list)
    has_quickgroups: bool = False
    has_fulltextsearch: bool = False


class CategoryOut(BaseModel):
    category_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    parent_category_id: Optional[str] = None
    ssd: Optional[str] = None
    has_children: bool = False


class CategoriesResponse(CatalogSoftBase):
    category_id: Optional[str] = None
    categories: list[CategoryOut] = Field(default_factory=list)


class UnitOut(BaseModel):
    unit_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    ssd: Optional[str] = None
    image_url: Optional[str] = None
    filter: Optional[str] = None


class UnitsResponse(CatalogSoftBase):
    category_id: Optional[str] = None
    units: list[UnitOut] = Field(default_factory=list)


class DetailOut(BaseModel):
    oem: Optional[str] = None
    name: Optional[str] = None
    code_on_image: Optional[str] = None
    ssd: Optional[str] = None
    detail_id: Optional[str] = None
    filter: Optional[Any] = None
    match: Optional[Any] = None


class UnitInfoOut(BaseModel):
    unit_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None
    ssd: Optional[str] = None
    image_url: Optional[str] = None
    filter: Optional[str] = None


class UnitDetailsResponse(CatalogSoftBase):
    unit: Optional[UnitInfoOut] = None
    details: list[DetailOut] = Field(default_factory=list)


class ImageMapOut(BaseModel):
    code_on_image: Optional[str] = None
    ssd: Optional[str] = None
    x1: Optional[Any] = None
    y1: Optional[Any] = None
    x2: Optional[Any] = None
    y2: Optional[Any] = None


class ImageMapResponse(CatalogSoftBase):
    unit_id: Optional[str] = None
    image_map: list[ImageMapOut] = Field(default_factory=list)


class QuickGroupOut(BaseModel):
    quick_group_id: Optional[str] = None
    name: Optional[str] = None
    ssd: Optional[str] = None
    link: bool = False
    parent_id: Optional[str] = None
    synonyms: Optional[str] = None


class QuickGroupsResponse(CatalogSoftBase):
    has_quickgroups: bool = False
    quick_groups: list[QuickGroupOut] = Field(default_factory=list)


class QuickGroupDetailsResponse(CatalogSoftBase):
    quick_group_id: Optional[str] = None
    unit: Optional[UnitInfoOut] = None
    details: list[DetailOut] = Field(default_factory=list)


class DetailsSearchRequest(BaseModel):
    catalog: str = Field(..., min_length=1)
    vehicle_id: str = Field(..., min_length=1)
    ssd: str = Field(..., min_length=1)
    query: str = Field(..., min_length=2, max_length=200)


class DetailsSearchResponse(CatalogSoftBase):
    query: Optional[str] = None
    details: list[DetailOut] = Field(default_factory=list)
    has_fulltextsearch: bool = False


class ApplicableVehiclesRequest(BaseModel):
    oem: str = Field(..., min_length=2, max_length=64)
    brand: Optional[str] = Field(None, max_length=64)


class ApplicableVehicleOut(BaseModel):
    brand: Optional[str] = None
    name: Optional[str] = None
    catalog: Optional[str] = None
    vehicle_id: Optional[str] = None
    year_from: Optional[str] = None
    year_to: Optional[str] = None
    attributes: Optional[list[dict[str, Any]]] = None


class ApplicableVehiclesResponse(CatalogSoftBase):
    oem: Optional[str] = None
    vehicles: list[ApplicableVehicleOut] = Field(default_factory=list)


class OemApplicabilityRequest(BaseModel):
    catalog: str = Field(..., min_length=1)
    ssd: str = Field(..., min_length=1)
    oem: str = Field(..., min_length=2, max_length=64)


class OemApplicabilityUnitOut(BaseModel):
    unit_id: Optional[str] = None
    code: Optional[str] = None
    name: Optional[str] = None


class OemApplicabilityResponse(CatalogSoftBase):
    oem: Optional[str] = None
    applicability: Optional[str] = None
    units: list[OemApplicabilityUnitOut] = Field(default_factory=list)


class FilterValueOut(BaseModel):
    name: Optional[str] = None
    note: Optional[str] = None
    ssd_modification: Optional[str] = None


class FilterConditionOut(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    regexp: Optional[str] = None
    ssd_modification: Optional[str] = None
    values: list[FilterValueOut] = Field(default_factory=list)


class FilterByUnitRequest(BaseModel):
    catalog: str = Field(..., min_length=1)
    vehicle_id: str = Field(..., min_length=1)
    ssd: str = Field(..., min_length=1)
    unit_id: str = Field(..., min_length=1)
    filter: str = Field(..., min_length=1)


class FilterByDetailRequest(BaseModel):
    catalog: str = Field(..., min_length=1)
    vehicle_id: str = Field(..., min_length=1)
    ssd: str = Field(..., min_length=1)
    unit_id: str = Field(..., min_length=1)
    detail_id: str = Field(..., min_length=1)
    filter: str = Field(..., min_length=1)


class FilterConditionsResponse(CatalogSoftBase):
    filter: Optional[str] = None
    unit_id: Optional[str] = None
    detail_id: Optional[str] = None
    conditions: list[FilterConditionOut] = Field(default_factory=list)


class FilterApplyRequest(BaseModel):
    ssd: str = Field(..., min_length=1)
    ssd_modification: str = Field(..., min_length=1)
    value: Optional[str] = Field(None, max_length=200)


class FilterApplyResponse(CatalogSoftBase):
    ssd: Optional[str] = None


class WizardCatalogOut(BaseModel):
    code: str
    brand: Optional[str] = None
    name: Optional[str] = None


class WizardCatalogsResponse(CatalogSoftBase):
    catalogs: list[WizardCatalogOut] = Field(default_factory=list)


class WizardOptionOut(BaseModel):
    key: Optional[str] = None
    value: Optional[str] = None


class WizardConditionOut(BaseModel):
    condition_id: Optional[str] = None
    name: Optional[str] = None
    determined: bool = False
    automatic: bool = False
    value: Optional[str] = None
    ssd: Optional[str] = None
    allow_list_vehicles: bool = False
    options: list[WizardOptionOut] = Field(default_factory=list)


class WizardStepRequest(BaseModel):
    catalog: str = Field(..., min_length=1)
    ssd: str = Field(default="", max_length=8000)


class WizardStepResponse(CatalogSoftBase):
    catalog: Optional[str] = None
    ssd: Optional[str] = None
    conditions: list[WizardConditionOut] = Field(default_factory=list)
    can_list_vehicles: bool = False


class WizardVehiclesRequest(BaseModel):
    catalog: str = Field(..., min_length=1)
    ssd: str = Field(..., min_length=1, max_length=8000)


class WizardVehiclesResponse(CatalogSoftBase):
    candidates: list[Any] = Field(default_factory=list)

