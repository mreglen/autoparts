from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_client import AutoserviceClient
from app.models.garage_vehicle import GarageVehicle
from app.models.user import User
from app.schemas.garage_vehicle import (
    GarageVehicleCreate,
    GarageVehicleDecodeFrameRequest,
    GarageVehicleDecodeFrameResponse,
    GarageVehicleDecodePlateRequest,
    GarageVehicleDecodePlateResponse,
    GarageVehicleDecodeVinRequest,
    GarageVehicleDecodeVinResponse,
    GarageVehicleStaffCreate,
    GarageVehicleUpdate,
    GarageVehicleView,
)
from app.services.laximo.vehicle_lookup import lookup_by_frame, lookup_by_plate, lookup_by_vin
from app.services.laximo.vin import normalize_vin_or_raise
from app.utils.autoservice_access import (
    related_autoservice_client_ids,
    require_autoservice_staff,
    require_my_active_autoservice_client,
)

router = APIRouter(tags=["Autoservice garage"])


def _optional_vin_or_400(vin: str | None) -> str | None:
    if vin is None or not str(vin).strip():
        return None
    return normalize_vin_or_raise(vin)


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


def _resolve_source_and_laximo(
    payload: GarageVehicleCreate,
) -> tuple[str, Optional[str], Optional[str], Optional[list[dict[str, Any]]]]:
    catalog = (payload.laximo_catalog or "").strip() or None
    vehicle_id = (payload.laximo_vehicle_id or "").strip() or None
    attrs = payload.laximo_attributes if isinstance(payload.laximo_attributes, list) else None
    source_raw = (payload.source or "").strip().lower()
    if source_raw == "plate":
        return "plate", catalog, vehicle_id, attrs
    if source_raw == "frame":
        return "frame", catalog, vehicle_id, attrs
    if source_raw == "laximo" or catalog or vehicle_id:
        return "laximo", catalog, vehicle_id, attrs
    return "manual", None, None, None


def _create_vehicle_for_client(
    db: Session,
    *,
    client: AutoserviceClient,
    payload: GarageVehicleCreate,
) -> GarageVehicle:
    vin = _optional_vin_or_400(payload.vin)
    if vin:
        existing = (
            db.query(GarageVehicle)
            .filter(
                GarageVehicle.client_id == client.id,
                GarageVehicle.vin == vin,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Автомобиль с таким VIN уже есть в гараже",
            )
    source, catalog, vehicle_id, attrs = _resolve_source_and_laximo(payload)
    row = GarageVehicle(
        client_id=client.id,
        organization_id=client.organization_id,
        vin=vin,
        make=payload.make.strip(),
        model=payload.model.strip(),
        year=payload.year,
        color=(payload.color or "").strip() or None,
        plate=(payload.plate or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        source=source,
        laximo_catalog=catalog,
        laximo_vehicle_id=vehicle_id,
        laximo_attributes=attrs,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post(
    "/autoservice/garage/decode-vin",
    response_model=GarageVehicleDecodeVinResponse,
)
def decode_garage_vin(
    payload: GarageVehicleDecodeVinRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_my_active_autoservice_client(db, current_user)
    result = lookup_by_vin(db, payload.vin)
    return GarageVehicleDecodeVinResponse(**result.to_response_dict())


@router.post(
    "/autoservice/garage/decode-plate",
    response_model=GarageVehicleDecodePlateResponse,
)
def decode_garage_plate(
    payload: GarageVehicleDecodePlateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_my_active_autoservice_client(db, current_user)
    result = lookup_by_plate(
        db,
        payload.plate,
        country_code=payload.country_code or "ru",
    )
    return GarageVehicleDecodePlateResponse(**result.to_response_dict())


@router.post(
    "/autoservice/garage/decode-frame",
    response_model=GarageVehicleDecodeFrameResponse,
)
def decode_garage_frame(
    payload: GarageVehicleDecodeFrameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_my_active_autoservice_client(db, current_user)
    result = lookup_by_frame(db, payload.frame)
    return GarageVehicleDecodeFrameResponse(**result.to_response_dict())


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
        related_ids = related_autoservice_client_ids(db, client)
        rows = (
            db.query(GarageVehicle)
            .filter(GarageVehicle.client_id.in_(related_ids))
            .order_by(GarageVehicle.updated_at.desc(), GarageVehicle.id.desc())
            .all()
        )
        return [_vehicle_to_view(row) for row in rows]

    my_client = require_my_active_autoservice_client(db, current_user)
    related_ids = related_autoservice_client_ids(db, my_client)
    rows = (
        db.query(GarageVehicle)
        .filter(GarageVehicle.client_id.in_(related_ids))
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
    row = _create_vehicle_for_client(db, client=my_client, payload=payload)
    return _vehicle_to_view(row)


@router.post(
    "/autoservice/garage/vehicles/staff",
    response_model=GarageVehicleView,
    status_code=status.HTTP_201_CREATED,
)
def create_garage_vehicle_staff(
    payload: GarageVehicleStaffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    client = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.id == payload.client_id,
            AutoserviceClient.organization_id == org_id,
            AutoserviceClient.status == "active",
        )
        .first()
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден",
        )
    row = _create_vehicle_for_client(db, client=client, payload=payload)
    return _vehicle_to_view(row)


def _apply_vehicle_update(db: Session, row: GarageVehicle, payload: GarageVehicleUpdate) -> GarageVehicle:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нет полей для обновления",
        )
    if "vin" in data:
        vin = _optional_vin_or_400(data["vin"])
        if vin:
            dup = (
                db.query(GarageVehicle)
                .filter(
                    GarageVehicle.client_id == row.client_id,
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
    return row


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
    row = _apply_vehicle_update(db, row, payload)
    return _vehicle_to_view(row)


@router.patch(
    "/autoservice/garage/vehicles/{vehicle_id}/staff",
    response_model=GarageVehicleView,
)
def update_garage_vehicle_staff(
    vehicle_id: int,
    payload: GarageVehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_staff(db, current_user)
    row = (
        db.query(GarageVehicle)
        .filter(
            GarageVehicle.id == vehicle_id,
            GarageVehicle.organization_id == org_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Автомобиль не найден",
        )
    client = (
        db.query(AutoserviceClient)
        .filter(
            AutoserviceClient.id == row.client_id,
            AutoserviceClient.organization_id == org_id,
        )
        .first()
    )
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Клиент не найден",
        )
    if client.user_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Редактировать можно только автомобили гостевых клиентов",
        )
    row = _apply_vehicle_update(db, row, payload)
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
