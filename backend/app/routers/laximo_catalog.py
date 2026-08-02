from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
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
    ImageMapResponse,
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
from app.services.laximo import unit_tree
from app.services.laximo.oem_applicability import (
    lookup_applicable_vehicles,
    lookup_oem_on_vehicle,
)
from app.services.laximo.wizard import (
    find_by_wizard,
    get_wizard_step,
    list_catalogs_for_wizard,
)

router = APIRouter(prefix="/laximo", tags=["Laximo Catalog"])


def _envelope(model_cls, result: unit_tree.SoftEnvelope):
    return model_cls(**result.to_dict())


@router.get("/catalog/features", response_model=CatalogFeaturesResponse)
def catalog_features(
    catalog: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(CatalogFeaturesResponse, unit_tree.get_features(db, catalog))


@router.get("/categories", response_model=CategoriesResponse)
def list_categories(
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    category_id: str = Query("-1"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def list_units(
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    category_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def get_unit(
    unit_id: str,
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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


@router.get("/units/{unit_id}/image-map", response_model=ImageMapResponse)
def get_unit_image_map(
    unit_id: str,
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(
        ImageMapResponse,
        unit_tree.get_unit_image_map(
            db,
            catalog=catalog,
            vehicle_id=vehicle_id,
            ssd=ssd,
            unit_id=unit_id,
        ),
    )


@router.get("/quick-groups", response_model=QuickGroupsResponse)
def list_quick_groups(
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def quick_group_details(
    quick_group_id: str,
    catalog: str = Query(...),
    vehicle_id: str = Query(...),
    ssd: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def search_vehicle_details(
    payload: DetailsSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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


@router.post("/oem/applicable-vehicles", response_model=ApplicableVehiclesResponse)
def oem_applicable_vehicles(
    payload: ApplicableVehiclesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(
        ApplicableVehiclesResponse,
        lookup_applicable_vehicles(db, oem=payload.oem, brand=payload.brand),
    )


@router.post("/oem/applicability", response_model=OemApplicabilityResponse)
def oem_applicability(
    payload: OemApplicabilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def filters_by_unit(
    payload: FilterByUnitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def filters_by_detail(
    payload: FilterByDetailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
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
def filters_apply(
    payload: FilterApplyRequest,
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(
        FilterApplyResponse,
        unit_tree.apply_filter_ssd(
            ssd=payload.ssd,
            ssd_modification=payload.ssd_modification,
            value=payload.value,
        ),
    )


@router.get("/wizard/catalogs", response_model=WizardCatalogsResponse)
def wizard_catalogs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(WizardCatalogsResponse, list_catalogs_for_wizard(db))


@router.post("/wizard/step", response_model=WizardStepResponse)
def wizard_step(
    payload: WizardStepRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(
        WizardStepResponse,
        get_wizard_step(db, catalog=payload.catalog, ssd=payload.ssd or ""),
    )


@router.post("/wizard/vehicles", response_model=WizardVehiclesResponse)
def wizard_vehicles(
    payload: WizardVehiclesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return _envelope(
        WizardVehiclesResponse,
        find_by_wizard(db, catalog=payload.catalog, ssd=payload.ssd),
    )
