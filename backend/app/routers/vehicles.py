import re
import requests
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.storage_location import StorageLocation as StorageLocationModel
from app.models.vehicle import Vehicle as VehicleModel
from app.models.vehicle_photo import VehiclePhoto
from app.models.vehicle_vin import VehicleVin
from app.models.vehicle_mileage import VehicleMileage
from app.models.transmission import Transmission, VehicleTransmission
from app.models.tecdoc import (
    TecdocManufacturer,
    TecdocModel,
    TecdocPassengercar,
    TecdocEngine,
)
from app.schemas.vehicle import Vehicle as VehicleSchema, VehicleCreate, VehicleUpdate

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

MAX_VEHICLE_PHOTOS = 10
# Разумный верхний предел пробега, км (защита от опечаток; в БД — BIGINT)
MAX_MILEAGE_KM = 9_999_999
_TEMP_PATH_RE = re.compile(r"^/temp/[^/]+/.+")


def _truncate(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    return value[:max_len]


def _assert_storage_location_for_org(
    db: Session,
    storage_location_id: int,
    organization_id: str,
) -> None:
    loc = (
        db.query(StorageLocationModel)
        .filter(
            StorageLocationModel.id == storage_location_id,
            StorageLocationModel.organization_id == organization_id,
        )
        .first()
    )
    if not loc:
        raise HTTPException(
            status_code=400,
            detail="Склад не найден или не принадлежит организации",
        )


def _norm_vehicle_description(raw) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    return s or None


def _tecdoc_row_to_dict(row) -> dict | None:
    if row is None:
        return None
    out = {}
    for col in row.__table__.columns:
        v = getattr(row, col.key)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.key] = v
    return out


def _refresh_tecdoc_json_columns(db: Session, v: VehicleModel) -> None:
    mid = v.tecdoc_manufacturer_id
    mob_id = v.tecdoc_model_id
    pc_id = v.tecdoc_passengercar_id
    eid = v.tecdoc_engine_id
    v.tecdoc_manufacturer_json = _tecdoc_row_to_dict(db.get(TecdocManufacturer, mid) if mid else None)
    v.tecdoc_model_json = _tecdoc_row_to_dict(db.get(TecdocModel, mob_id) if mob_id else None)
    v.tecdoc_passengercar_json = _tecdoc_row_to_dict(db.get(TecdocPassengercar, pc_id) if pc_id else None)
    v.tecdoc_engine_json = _tecdoc_row_to_dict(db.get(TecdocEngine, eid) if eid else None)


def _apply_reference_transmission(
    db: Session,
    db_vehicle: VehicleModel,
    transmission_id: int | None,
) -> None:
    """Связь vehicle_transmissions + дублирование названия в vehicles.transmission."""
    if transmission_id is None:
        if db_vehicle.transmission_assignment is not None:
            db.delete(db_vehicle.transmission_assignment)
        return
    tx = db.get(Transmission, transmission_id)
    if not tx:
        raise HTTPException(status_code=400, detail="Тип КПП не найден")
    db_vehicle.transmission = _truncate((tx.name or "").strip(), 30) or None
    db_vehicle.tecdoc_transmission_json = None
    link = db_vehicle.transmission_assignment
    if link is not None:
        link.transmission_id = transmission_id
    else:
        db.add(
            VehicleTransmission(
                vehicle_id=db_vehicle.id,
                transmission_id=transmission_id,
            )
        )


def _apply_tecdoc_labels(db: Session, data: dict) -> None:
    """Fill display strings from TecDoc rows when ids are set (in-place)."""
    mid = data.get("tecdoc_manufacturer_id")
    if mid is not None:
        m = db.get(TecdocManufacturer, mid)
        if m and m.Description:
            data["brand"] = _truncate(m.Description, 50)

    mob_id = data.get("tecdoc_model_id")
    if mob_id is not None:
        mo = db.get(TecdocModel, mob_id)
        if mo and mo.Description:
            data["model"] = _truncate(mo.Description, 100)

    pc_id = data.get("tecdoc_passengercar_id")
    if pc_id is not None:
        pc = db.get(TecdocPassengercar, pc_id)
        if pc:
            gen = pc.FullDescription or pc.Description or data.get("generation")
            data["generation"] = _truncate(gen, 50)

    eid = data.get("tecdoc_engine_id")
    if eid is not None:
        eng = db.get(TecdocEngine, eid)
        if eng:
            desc = eng.SalesDescription or eng.Description or data.get("engine")
            data["engine"] = _truncate(desc, 50)


@router.get("/", response_model=list[VehicleSchema])
def get_vehicles(
    storage_location_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    q = (
        db.query(VehicleModel)
        .options(
            joinedload(VehicleModel.vin_row),
            joinedload(VehicleModel.mileage_row),
            joinedload(VehicleModel.photos),
            joinedload(VehicleModel.transmission_assignment),
        )
        .filter(VehicleModel.organization_id == current_user.organization_id)
    )
    if storage_location_id is not None:
        q = q.filter(VehicleModel.storage_location_id == storage_location_id)
    vehicles = q.all()
    return vehicles


@router.patch("/{vehicle_id}", response_model=VehicleSchema)
def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")

    db_vehicle = (
        db.query(VehicleModel)
        .options(
            joinedload(VehicleModel.vin_row),
            joinedload(VehicleModel.mileage_row),
            joinedload(VehicleModel.photos),
            joinedload(VehicleModel.transmission_assignment),
        )
        .filter(
            VehicleModel.id == vehicle_id,
            VehicleModel.organization_id == current_user.organization_id,
        )
        .first()
    )
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")

    data = body.model_dump(exclude_unset=True)

    tecdoc_patch_keys = (
        "tecdoc_manufacturer_id",
        "tecdoc_model_id",
        "tecdoc_passengercar_id",
        "tecdoc_engine_id",
        "tecdoc_transmission_json",
    )
    has_tecdoc_patch = any(k in data for k in tecdoc_patch_keys)

    if has_tecdoc_patch:
        for k in tecdoc_patch_keys:
            if k in data:
                setattr(db_vehicle, k, data[k])
        _refresh_tecdoc_json_columns(db, db_vehicle)

        label = {
            "brand": db_vehicle.brand,
            "model": db_vehicle.model,
            "generation": db_vehicle.generation,
            "engine": db_vehicle.engine,
            "tecdoc_manufacturer_id": db_vehicle.tecdoc_manufacturer_id,
            "tecdoc_model_id": db_vehicle.tecdoc_model_id,
            "tecdoc_passengercar_id": db_vehicle.tecdoc_passengercar_id,
            "tecdoc_engine_id": db_vehicle.tecdoc_engine_id,
        }
        if "brand" in data and data["brand"] is not None:
            label["brand"] = data["brand"]
        if "model" in data and data["model"] is not None:
            label["model"] = data["model"]
        if "generation" in data:
            label["generation"] = data.get("generation")
        if "engine" in data:
            label["engine"] = data.get("engine")

        _apply_tecdoc_labels(db, label)

        nb = _truncate((label.get("brand") or "").strip(), 50)
        if nb:
            db_vehicle.brand = nb
        nm = _truncate((label.get("model") or "").strip(), 100)
        if nm:
            db_vehicle.model = nm
        g = label.get("generation")
        db_vehicle.generation = _truncate(g.strip(), 50) if g and str(g).strip() else None
        e = label.get("engine")
        db_vehicle.engine = _truncate(e.strip(), 50) if e and str(e).strip() else None
    else:
        if "brand" in data and data["brand"] is not None:
            trimmed = data["brand"].strip()
            if trimmed:
                db_vehicle.brand = _truncate(trimmed, 50)
        if "model" in data and data["model"] is not None:
            trimmed = data["model"].strip()
            if trimmed:
                db_vehicle.model = _truncate(trimmed, 100)
        if "generation" in data:
            g = data.get("generation")
            db_vehicle.generation = _truncate(g.strip(), 50) if g and str(g).strip() else None
        if "engine" in data:
            e = data.get("engine")
            db_vehicle.engine = _truncate(e.strip(), 50) if e and str(e).strip() else None

    if "transmission_id" in data:
        _apply_reference_transmission(db, db_vehicle, data.get("transmission_id"))
    elif "transmission" in data:
        t = data.get("transmission")
        db_vehicle.transmission = _truncate(t.strip(), 30) if t and str(t).strip() else None
    if "price" in data:
        pv = data.get("price")
        if pv is None:
            db_vehicle.price = None
        else:
            db_vehicle.price = Decimal(str(pv)) if not isinstance(pv, Decimal) else pv

    if "vin" in data:
        vin_raw = data.get("vin")
        norm_vin = vin_raw.strip().upper() if vin_raw and str(vin_raw).strip() else None
        if norm_vin and len(norm_vin) != 17:
            raise HTTPException(status_code=400, detail="VIN должен содержать ровно 17 символов")
        if norm_vin:
            dup = (
                db.query(VehicleModel.id)
                .join(VehicleVin, VehicleVin.vehicle_id == VehicleModel.id)
                .filter(
                    VehicleModel.organization_id == current_user.organization_id,
                    VehicleVin.vin == norm_vin,
                    VehicleModel.id != vehicle_id,
                )
                .first()
            )
            if dup:
                raise HTTPException(status_code=400, detail="Автомобиль с таким VIN уже существует")
        if db_vehicle.vin_row:
            if norm_vin:
                db_vehicle.vin_row.vin = norm_vin
            else:
                db.delete(db_vehicle.vin_row)
        elif norm_vin:
            db.add(VehicleVin(vehicle_id=db_vehicle.id, vin=norm_vin))

    if "description" in data:
        db_vehicle.description = _norm_vehicle_description(data.get("description"))

    if "mileage" in data:
        mileage_raw = data.get("mileage")
        if mileage_raw is None:
            if db_vehicle.mileage_row:
                db.delete(db_vehicle.mileage_row)
        else:
            try:
                mileage_int = int(mileage_raw)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Некорректный пробег")
            if mileage_int < 0:
                raise HTTPException(status_code=400, detail="Пробег не может быть отрицательным")
            if mileage_int > MAX_MILEAGE_KM:
                raise HTTPException(
                    status_code=400,
                    detail=f"Пробег слишком большой (максимум {MAX_MILEAGE_KM:,} км)".replace(",", " "),
                )
            if db_vehicle.mileage_row:
                db_vehicle.mileage_row.mileage = mileage_int
            else:
                db.add(VehicleMileage(vehicle_id=db_vehicle.id, mileage=mileage_int))

    if "storage_location_id" in data:
        sid = data.get("storage_location_id")
        if sid is None:
            db_vehicle.storage_location_id = None
        else:
            _assert_storage_location_for_org(db, int(sid), current_user.organization_id)
            db_vehicle.storage_location_id = int(sid)

    db.commit()

    db_vehicle = (
        db.query(VehicleModel)
        .options(
            joinedload(VehicleModel.vin_row),
            joinedload(VehicleModel.mileage_row),
            joinedload(VehicleModel.photos),
            joinedload(VehicleModel.transmission_assignment),
        )
        .filter(VehicleModel.id == vehicle_id)
        .one()
    )
    return db_vehicle


@router.post("/", response_model=VehicleSchema)
def create_vehicle(
    request: Request,
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")

    payload = vehicle.model_dump()
    storage_location_id = payload.pop("storage_location_id", None)
    if storage_location_id is not None:
        _assert_storage_location_for_org(db, storage_location_id, current_user.organization_id)
    transmission_id = payload.pop("transmission_id", None)
    vin_raw = payload.pop("vin", None)
    mileage_raw = payload.pop("mileage", None)
    photo_paths = payload.pop("photos") or []
    if len(photo_paths) > MAX_VEHICLE_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Максимум {MAX_VEHICLE_PHOTOS} фотографий")

    for p in photo_paths:
        if not isinstance(p, str) or not _TEMP_PATH_RE.match(p.strip()):
            raise HTTPException(
                status_code=400,
                detail="Каждое фото должно быть temp-путём вида /temp/{organization_id}/filename",
            )

    price_val = payload.pop("price", None)
    if price_val is not None and not isinstance(price_val, Decimal):
        price_val = Decimal(str(price_val))

    description_val = _norm_vehicle_description(payload.pop("description", None))

    _apply_tecdoc_labels(db, payload)

    payload["brand"] = _truncate(payload.get("brand"), 50) or ""
    payload["model"] = _truncate(payload.get("model"), 100) or ""
    payload["generation"] = _truncate(payload.get("generation"), 50)
    payload["engine"] = _truncate(payload.get("engine"), 50)
    if transmission_id is not None:
        tx = db.get(Transmission, transmission_id)
        if not tx:
            raise HTTPException(status_code=400, detail="Тип КПП не найден")
        payload["transmission"] = _truncate((tx.name or "").strip(), 30)
        payload["tecdoc_transmission_json"] = None
    else:
        payload["transmission"] = _truncate(payload.get("transmission"), 30)

    mid = payload.get("tecdoc_manufacturer_id")
    mob_id = payload.get("tecdoc_model_id")
    pc_id = payload.get("tecdoc_passengercar_id")
    eid = payload.get("tecdoc_engine_id")

    tecdoc_manufacturer_json = _tecdoc_row_to_dict(db.get(TecdocManufacturer, mid) if mid else None)
    tecdoc_model_json = _tecdoc_row_to_dict(db.get(TecdocModel, mob_id) if mob_id else None)
    tecdoc_passengercar_json = _tecdoc_row_to_dict(db.get(TecdocPassengercar, pc_id) if pc_id else None)
    tecdoc_engine_json = _tecdoc_row_to_dict(db.get(TecdocEngine, eid) if eid else None)

    norm_vin = vin_raw.strip().upper() if vin_raw and str(vin_raw).strip() else None
    if norm_vin and len(norm_vin) != 17:
        raise HTTPException(status_code=400, detail="VIN должен содержать ровно 17 символов")

    if norm_vin:
        dup = (
            db.query(VehicleModel.id)
            .join(VehicleVin, VehicleVin.vehicle_id == VehicleModel.id)
            .filter(
                VehicleModel.organization_id == current_user.organization_id,
                VehicleVin.vin == norm_vin,
            )
            .first()
        )
        if dup:
            raise HTTPException(status_code=400, detail="Автомобиль с таким VIN уже существует")

    mileage_int: int | None = None
    if mileage_raw is not None and mileage_raw != "":
        try:
            mileage_int = int(mileage_raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Некорректный пробег")
        if mileage_int < 0:
            raise HTTPException(status_code=400, detail="Пробег не может быть отрицательным")
        if mileage_int > MAX_MILEAGE_KM:
            raise HTTPException(
                status_code=400,
                detail=f"Пробег слишком большой (максимум {MAX_MILEAGE_KM:,} км)".replace(",", " "),
            )

    db_vehicle = VehicleModel(
        brand=payload["brand"],
        model=payload["model"],
        generation=payload.get("generation"),
        engine=payload.get("engine"),
        transmission=payload.get("transmission"),
        description=description_val,
        tecdoc_manufacturer_id=payload.get("tecdoc_manufacturer_id"),
        tecdoc_model_id=payload.get("tecdoc_model_id"),
        tecdoc_passengercar_id=payload.get("tecdoc_passengercar_id"),
        tecdoc_engine_id=payload.get("tecdoc_engine_id"),
        organization_id=current_user.organization_id,
        storage_location_id=storage_location_id,
        price=price_val,
        created_by=current_user.id,
        tecdoc_manufacturer_json=tecdoc_manufacturer_json,
        tecdoc_model_json=tecdoc_model_json,
        tecdoc_passengercar_json=tecdoc_passengercar_json,
        tecdoc_engine_json=tecdoc_engine_json,
        tecdoc_transmission_json=payload.get("tecdoc_transmission_json"),
    )
    db.add(db_vehicle)
    db.flush()

    if transmission_id is not None:
        db.add(
            VehicleTransmission(
                vehicle_id=db_vehicle.id,
                transmission_id=transmission_id,
            )
        )

    if norm_vin:
        db.add(VehicleVin(vehicle_id=db_vehicle.id, vin=norm_vin))
    if mileage_int is not None:
        db.add(VehicleMileage(vehicle_id=db_vehicle.id, mileage=mileage_int))

    vehicle_photo_ids: list[int] = []
    for idx, path in enumerate(photo_paths):
        path = path.strip()
        vp = VehiclePhoto(
            vehicle_id=db_vehicle.id,
            organization_id=current_user.organization_id,
            photo_path=path,
            processing_status="pending",
            sort_order=idx,
        )
        db.add(vp)
        db.flush()
        vehicle_photo_ids.append(vp.id)

    db.commit()

    # Celery только после сохранения авто: в БД пока пути /temp/...; задача пишет файл в vehicle_pictures,
    # затем атомарно меняет photo_path и только после успешного commit удаляет temp.
    base_url = settings.BASE_URL.rstrip("/")
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    for vid in vehicle_photo_ids:
        try:
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            requests.post(
                f"{base_url}/api/upload/start-vehicle-photo-processing/{vid}",
                headers=headers,
                timeout=10,
            )
        except Exception:
            pass

    db_vehicle = (
        db.query(VehicleModel)
        .options(
            joinedload(VehicleModel.vin_row),
            joinedload(VehicleModel.mileage_row),
            joinedload(VehicleModel.photos),
            joinedload(VehicleModel.transmission_assignment),
        )
        .filter(VehicleModel.id == db_vehicle.id)
        .one()
    )
    return db_vehicle
