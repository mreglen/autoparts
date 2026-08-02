from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.laximo_catalog import (
    ApplicableVehiclesRequest,
    ApplicableVehiclesResponse,
    CatalogFeaturesResponse,
    CategoriesResponse,
    DetailsSearchRequest,
    DetailsSearchResponse,
    FilterApplyRequest,
    FilterApplyResponse,
    FilterByDetailRequest,
    FilterByUnitRequest,
    FilterConditionsResponse,
    OemApplicabilityRequest,
    OemApplicabilityResponse,
    QuickGroupDetailsResponse,
    QuickGroupsResponse,
    UnitDetailsResponse,
    UnitsResponse,
    WizardCatalogsResponse,
    WizardStepRequest,
    WizardStepResponse,
    WizardVehiclesRequest,
    WizardVehiclesResponse,
)
from app.schemas.laximo_vehicle import ByVinResponse, VinLookupRequest
from app.services.laximo import unit_tree
from app.services.laximo.oem_applicability import (
    lookup_applicable_vehicles,
    lookup_oem_on_vehicle,
)
from app.services.laximo.oem_availability import lookup_oem_availability
from app.services.laximo.vehicle_lookup import lookup_by_vin
from app.services.laximo.wizard import (
    find_by_wizard,
    get_wizard_step,
    list_catalogs_for_wizard,
)

router = APIRouter(prefix="/public/laximo", tags=["Public Laximo"])


def _envelope(model_cls, result: unit_tree.SoftEnvelope):
    return model_cls(**result.to_dict())


class OemAvailabilityRequest(BaseModel):
    oems: list[str] = Field(default_factory=list, max_length=40)


class OemRosskoOut(BaseModel):
    available: bool = False
    count: int = 0
    min_price: Optional[float] = None
    sample: Optional[dict[str, Any]] = None


class OemUsedOut(BaseModel):
    available: bool = False
    count: int = 0
    sample_product_id: Optional[int] = None


class OemAnalogItemOut(BaseModel):
    brand: Optional[str] = None
    oem: str
    name: Optional[str] = None
    rossko: OemRosskoOut = Field(default_factory=OemRosskoOut)
    used: OemUsedOut = Field(default_factory=OemUsedOut)


class OemAnalogsOut(BaseModel):
    available: bool = False
    count: int = 0
    items: list[OemAnalogItemOut] = Field(default_factory=list)


class OemAvailabilityItem(BaseModel):
    oem: str
    normalized_oem: str
    rossko: OemRosskoOut = Field(default_factory=OemRosskoOut)
    used: OemUsedOut = Field(default_factory=OemUsedOut)
    analogs: OemAnalogsOut = Field(default_factory=OemAnalogsOut)


class OemAvailabilityResponse(BaseModel):
    ok: bool = True
    reason: str = "ok"
    message: Optional[str] = None
    items: list[OemAvailabilityItem] = Field(default_factory=list)


@router.post("/vehicles/by-vin", response_model=ByVinResponse)
def public_vehicles_by_vin(
    payload: VinLookupRequest,
    db: Session = Depends(get_db),
):
    result = lookup_by_vin(db, payload.vin)
    return ByVinResponse(**result.to_response_dict())


@router.get("/catalog/features", response_model=CatalogFeaturesResponse)
def public_catalog_features(
    catalog: str = Query(...),
    db: Session = Depends(get_db),
):
    return _envelope(CatalogFeaturesResponse, unit_tree.get_features(db, catalog))


@router.get("/categories", response_model=CategoriesResponse)
def public_categories(
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    category_id: str = Query("-1"),
    db: Session = Depends(get_db),
):
    return _envelope(
        CategoriesResponse,
        unit_tree.get_categories(
            db,
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            category_id=category_id,
        ),
    )


@router.get("/units", response_model=UnitsResponse)
def public_units(
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    category_id: str = Query(...),
    db: Session = Depends(get_db),
):
    return _envelope(
        UnitsResponse,
        unit_tree.get_units(
            db,
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            category_id=category_id,
        ),
    )


@router.get("/units/{unit_id}", response_model=UnitDetailsResponse)
def public_unit(
    unit_id: str,
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
):
    return _envelope(
        UnitDetailsResponse,
        unit_tree.get_unit_with_details(
            db,
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            unit_id=unit_id,
        ),
    )


@router.get("/quick-groups", response_model=QuickGroupsResponse)
def public_quick_groups(
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
):
    return _envelope(
        QuickGroupsResponse,
        unit_tree.get_quick_groups(
            db,
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
        ),
    )


@router.get("/quick-groups/{quick_group_id}/details", response_model=QuickGroupDetailsResponse)
def public_quick_group_details(
    quick_group_id: str,
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
):
    return _envelope(
        QuickGroupDetailsResponse,
        unit_tree.get_quick_group_details(
            db,
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            quick_group_id=quick_group_id,
        ),
    )


@router.post("/details/search", response_model=DetailsSearchResponse)
def public_details_search(
    payload: DetailsSearchRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        DetailsSearchResponse,
        unit_tree.search_details(
            db,
            catalog=payload.catalog,
            vehicle_id=payload.vehicle_id,
            ssd=payload.ssd,
            query=payload.query,
        ),
    )


@router.post("/oem/availability", response_model=OemAvailabilityResponse)
def public_oem_availability(
    payload: OemAvailabilityRequest,
    db: Session = Depends(get_db),
):
    data = lookup_oem_availability(db, payload.oems)
    return OemAvailabilityResponse(**data)


@router.post("/oem/applicable-vehicles", response_model=ApplicableVehiclesResponse)
def public_oem_applicable_vehicles(
    payload: ApplicableVehiclesRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        ApplicableVehiclesResponse,
        lookup_applicable_vehicles(db, oem=payload.oem, brand=payload.brand),
    )


@router.post("/oem/applicability", response_model=OemApplicabilityResponse)
def public_oem_applicability(
    payload: OemApplicabilityRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        OemApplicabilityResponse,
        lookup_oem_on_vehicle(
            db,
            catalog=payload.catalog,
            ssd=payload.ssd,
            oem=payload.oem,
        ),
    )


@router.post("/filters/by-unit", response_model=FilterConditionsResponse)
def public_filters_by_unit(
    payload: FilterByUnitRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        FilterConditionsResponse,
        unit_tree.get_unit_filters(
            db,
            catalog=payload.catalog,
            vehicle_id=payload.vehicle_id,
            ssd=payload.ssd,
            unit_id=payload.unit_id,
            filter_code=payload.filter,
        ),
    )


@router.post("/filters/by-detail", response_model=FilterConditionsResponse)
def public_filters_by_detail(
    payload: FilterByDetailRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        FilterConditionsResponse,
        unit_tree.get_detail_filters(
            db,
            catalog=payload.catalog,
            vehicle_id=payload.vehicle_id,
            ssd=payload.ssd,
            unit_id=payload.unit_id,
            detail_id=payload.detail_id,
            filter_code=payload.filter,
        ),
    )


@router.post("/filters/apply", response_model=FilterApplyResponse)
def public_filters_apply(payload: FilterApplyRequest):
    return _envelope(
        FilterApplyResponse,
        unit_tree.apply_filter_ssd(
            ssd=payload.ssd,
            ssd_modification=payload.ssd_modification,
            value=payload.value,
        ),
    )


@router.get("/wizard/catalogs", response_model=WizardCatalogsResponse)
def public_wizard_catalogs(db: Session = Depends(get_db)):
    return _envelope(WizardCatalogsResponse, list_catalogs_for_wizard(db))


@router.post("/wizard/step", response_model=WizardStepResponse)
def public_wizard_step(
    payload: WizardStepRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        WizardStepResponse,
        get_wizard_step(db, catalog=payload.catalog, ssd=payload.ssd or ""),
    )


@router.post("/wizard/vehicles", response_model=WizardVehiclesResponse)
def public_wizard_vehicles(
    payload: WizardVehiclesRequest,
    db: Session = Depends(get_db),
):
    return _envelope(
        WizardVehiclesResponse,
        find_by_wizard(db, catalog=payload.catalog, ssd=payload.ssd),
    )
