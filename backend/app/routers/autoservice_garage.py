from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.user import User
from app.schemas.garage_vehicle import (
    GarageVehicleCreate,
    GarageVehicleDecodeVinRequest,
    GarageVehicleDecodeVinResponse,
    GarageVehicleUpdate,
    GarageVehicleView,
)
from app.utils.autoservice_access import (
    require_autoservice_staff,
    require_my_active_autoservice_client,
)

router = APIRouter(tags=["Autoservice garage"])


def _normalize_vin_or_400(vin: str | None) -> str | None:
    if not vin or not str(vin).strip():
        return None
    norm = str(vin).strip().upper()
    if len(norm) != 17:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VIN должен содержать ровно 17 символов",
        )
    return norm


def _vehicle_to_view(row: GarageVehicle) -> GarageVehicleView:
    return GarageVehicleView.model_validate(row)


def _get_client_vehicle_or_404(
    db: Session,
    vehicle_id: int,
    client_id: int,
) -> GarageVehicle:
    row = (
        db.query(GarageVehicle)
        .filter(
            GarageVehicle.id == vehicle_id,
            GarageVehicle.client_id == client_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Автомобиль не найден",
        )
    return row


@router.post(
    "/autoservice/garage/decode-vin",
    response_model=GarageVehicleDecodeVinResponse,
)
def decode_garage_vin_stub(
    payload: GarageVehicleDecodeVinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_my_active_autoservice_client(db, current_user)
    _normalize_vin_or_400(payload.vin)
    return GarageVehicleDecodeVinResponse(ok=False, reason="not_found")


@router.get("/autoservice/garage/vehicles", response_model=list[GarageVehicleView])
def list_garage_vehicles(
    client_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if client_id is not None:
        org_id = require_autoservice_staff(db, current_user)
        client = (
            db.query(AutoserviceClient)
            .filter(
                AutoserviceClient.id == client_id,
                AutoserviceClient.organization_id == org_id,
            )
            .first()
        )
        if not client:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Клиент не найден",
            )
        rows = (
            db.query(GarageVehicle)
            .filter(GarageVehicle.client_id == client_id)
            .order_by(GarageVehicle.updated_at.desc(), GarageVehicle.id.desc())
            .all()
        )
        return [_vehicle_to_view(row) for row in rows]

    my_client = require_my_active_autoservice_client(db, current_user)
    rows = (
        db.query(GarageVehicle)
        .filter(GarageVehicle.client_id == my_client.id)
        .order_by(GarageVehicle.updated_at.desc(), GarageVehicle.id.desc())
        .all()
    )
    return [_vehicle_to_view(row) for row in rows]


@router.post(
    "/autoservice/garage/vehicles",
    response_model=GarageVehicleView,
    status_code=status.HTTP_201_CREATED,
)
def create_garage_vehicle(
    payload: GarageVehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    my_client = require_my_active_autoservice_client(db, current_user)
    vin = _normalize_vin_or_400(payload.vin)
    if vin:
        existing = (
            db.query(GarageVehicle)
            .filter(
                GarageVehicle.client_id == my_client.id,
                GarageVehicle.vin == vin,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Автомобиль с таким VIN уже есть в гараже",
            )
    row = GarageVehicle(
        client_id=my_client.id,
        organization_id=my_client.organization_id,
        vin=vin,
        make=payload.make.strip(),
        model=payload.model.strip(),
        year=payload.year,
        color=(payload.color or "").strip() or None,
        plate=(payload.plate or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        source="manual",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _vehicle_to_view(row)


@router.patch(
    "/autoservice/garage/vehicles/{vehicle_id}",
    response_model=GarageVehicleView,
)
def update_garage_vehicle(
    vehicle_id: int,
    payload: GarageVehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    my_client = require_my_active_autoservice_client(db, current_user)
    row = _get_client_vehicle_or_404(db, vehicle_id, my_client.id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    if "vin" in data:
        vin = _normalize_vin_or_400(data["vin"])
        if vin:
            dup = (
                db.query(GarageVehicle)
                .filter(
                    GarageVehicle.client_id == my_client.id,
                    GarageVehicle.vin == vin,
                    GarageVehicle.id != row.id,
                )
                .first()
            )
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Автомобиль с таким VIN уже есть в гараже",
                )
        row.vin = vin
    if "make" in data and data["make"] is not None:
        row.make = data["make"].strip()
    if "model" in data and data["model"] is not None:
        row.model = data["model"].strip()
    if "year" in data:
        row.year = data["year"]
    if "color" in data:
        row.color = (data["color"] or "").strip() or None
    if "plate" in data:
        row.plate = (data["plate"] or "").strip() or None
    if "notes" in data:
        row.notes = (data["notes"] or "").strip() or None
    db.commit()
    db.refresh(row)
    return _vehicle_to_view(row)


@router.delete(
    "/autoservice/garage/vehicles/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_garage_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    my_client = require_my_active_autoservice_client(db, current_user)
    row = _get_client_vehicle_or_404(db, vehicle_id, my_client.id)
    db.delete(row)
    db.commit()
    return None
