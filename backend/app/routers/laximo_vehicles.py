from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.laximo_vehicle import (
    ByFrameResponse,
    ByPlateResponse,
    ByVinResponse,
    FrameLookupRequest,
    PlateLookupRequest,
    VinLookupRequest,
)
from app.services.laximo.vehicle_lookup import lookup_by_frame, lookup_by_plate, lookup_by_vin

router = APIRouter(prefix="/laximo/vehicles", tags=["Laximo Vehicles"])


@router.post("/by-vin", response_model=ByVinResponse)
def vehicles_by_vin(
    payload: VinLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find vehicle candidates by VIN via Laximo.CAT (gated, soft-fail)."""
    _ = current_user
    result = lookup_by_vin(db, payload.vin)
    return ByVinResponse(**result.to_response_dict())


@router.post("/by-plate", response_model=ByPlateResponse)
def vehicles_by_plate(
    payload: PlateLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find vehicle candidates by RU plate via identifyByPlateNumberFull (gated)."""
    _ = current_user
    result = lookup_by_plate(db, payload.plate, country_code=payload.country_code or "ru")
    return ByPlateResponse(**result.to_response_dict())


@router.post("/by-frame", response_model=ByFrameResponse)
def vehicles_by_frame(
    payload: FrameLookupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Find vehicle candidates by Frame (JP body code) via FindVehicle."""
    _ = current_user
    result = lookup_by_frame(db, payload.frame)
    return ByFrameResponse(**result.to_response_dict())
