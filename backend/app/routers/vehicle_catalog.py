from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import bindparam, or_, text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.tecdoc import (
    TecdocManufacturer,
    TecdocModel,
    TecdocEngine,
    TecdocPassengercar,
    TecdocPassengercarLinkEngine,
)
from app.schemas.vehicle_catalog import (
    TecdocManufacturerOut,
    TecdocModelOut,
    TecdocPassengercarOut,
    TecdocEngineOut,
    TecdocTransmissionOut,
)

router = APIRouter(prefix="/vehicle-catalog", tags=["Vehicle catalog"])

_PASSENGER_FILTER = or_(
    TecdocManufacturer.IsPassengerCar == True,
    TecdocManufacturer.IsPassengerCar.is_(None),
)
_DISPLAY_OK = or_(
    TecdocManufacturer.CanBeDisplayed == True,
    TecdocManufacturer.CanBeDisplayed.is_(None),
)


@router.get("/manufacturers", response_model=list[TecdocManufacturerOut])
def search_manufacturers(
    q: str = "",
    limit: int = 80,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    qry = db.query(TecdocManufacturer).filter(_PASSENGER_FILTER, _DISPLAY_OK)
    if q and q.strip():
        term = f"%{q.strip()}%"
        qry = qry.filter(
            or_(
                TecdocManufacturer.Description.ilike(term),
                TecdocManufacturer.Matchcode.ilike(term),
            )
        )
    rows = qry.order_by(TecdocManufacturer.Description.asc().nulls_last()).limit(min(limit, 200)).all()
    return [
        TecdocManufacturerOut(
            id=r.id,
            description=r.Description,
            matchcode=r.Matchcode,
        )
        for r in rows
    ]


_MODEL_PAX = or_(TecdocModel.IsPassengerCar == True, TecdocModel.IsPassengerCar.is_(None))
_MODEL_DIS = or_(TecdocModel.CanBeDisplayed == True, TecdocModel.CanBeDisplayed.is_(None))


@router.get("/manufacturers/{manufacturer_id}/models", response_model=list[TecdocModelOut])
def list_models_for_manufacturer(
    manufacturer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(TecdocModel)
        .filter(
            TecdocModel.ManufacturerId == manufacturer_id,
            _MODEL_PAX,
            _MODEL_DIS,
        )
        .order_by(TecdocModel.Description.asc().nulls_last())
        .all()
    )
    return [TecdocModelOut.from_row(r) for r in rows]


@router.get("/models/{model_id}/passengercars", response_model=list[TecdocPassengercarOut])
def list_passengercars_for_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(TecdocPassengercar)
        .filter(TecdocPassengercar.Model == model_id)
        .order_by(TecdocPassengercar.Description.asc().nulls_last())
        .all()
    )
    return [TecdocPassengercarOut.from_row(r) for r in rows]


@router.get("/passengercars/{passengercar_id}/engines", response_model=list[TecdocEngineOut])
def list_engines_for_passengercar(
    passengercar_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(TecdocEngine)
        .join(
            TecdocPassengercarLinkEngine,
            TecdocPassengercarLinkEngine.engine_id == TecdocEngine.id,
        )
        .filter(TecdocPassengercarLinkEngine.car_id == passengercar_id)
        .order_by(TecdocEngine.Description.asc().nulls_last())
        .all()
    )
    return [TecdocEngineOut.from_row(r) for r in rows]


_TRANSMISSION_SQL = text(
    """
    SELECT DISTINCT
        COALESCE("DisplayTitle", '') AS title,
        COALESCE("DisplayValue", '') AS val
    FROM tecdoc_items_atributes
    WHERE (item_id IN :ids OR "ParentLinkitem" IN :ids)
      AND COALESCE(TRIM(COALESCE("DisplayValue", '')), '') <> ''
      AND (
        LOWER(COALESCE("AttributeGroup", '')) LIKE '%trans%'
        OR LOWER(COALESCE("AttributeGroup", '')) LIKE '%gear%'
        OR LOWER(COALESCE("AttributeGroup", '')) LIKE '%getrieb%'
        OR LOWER(COALESCE("AttributeType", '')) LIKE '%trans%'
        OR LOWER(COALESCE("AttributeType", '')) LIKE '%gear%'
        OR LOWER(COALESCE("AttributeType", '')) LIKE '%getrieb%'
        OR LOWER(COALESCE("DisplayTitle", '')) LIKE '%короб%'
        OR LOWER(COALESCE("DisplayTitle", '')) LIKE '%кпп%'
        OR LOWER(COALESCE("DisplayTitle", '')) LIKE '%gear%'
        OR LOWER(COALESCE("DisplayTitle", '')) LIKE '%trans%'
        OR LOWER(COALESCE("DisplayTitle", '')) LIKE '%getrieb%'
        OR LOWER(COALESCE("DisplayTitle", '')) LIKE '%schalt%'
        OR LOWER(COALESCE("DisplayValue", '')) LIKE '%akpp%'
        OR LOWER(COALESCE("DisplayValue", '')) LIKE '%мкпп%'
        OR LOWER(COALESCE("DisplayValue", '')) LIKE '%вариатор%'
        OR LOWER(COALESCE("DisplayValue", '')) LIKE '%cvt%'
        OR LOWER(COALESCE("DisplayValue", '')) LIKE '%dsg%'
        OR LOWER(COALESCE("LinkitemType", '')) LIKE '%trans%'
        OR LOWER(COALESCE("LinkitemType", '')) LIKE '%gear%'
        OR LOWER(COALESCE("LinkitemType", '')) LIKE '%getrieb%'
      )
    ORDER BY title, val
    """
).bindparams(bindparam("ids", expanding=True))


@router.get("/passengercars/{passengercar_id}/transmissions", response_model=list[TecdocTransmissionOut])
def list_transmissions_for_passengercar(
    passengercar_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    pc = db.get(TecdocPassengercar, passengercar_id)
    if not pc:
        raise HTTPException(status_code=404, detail="Поколение не найдено")

    ids: list[int] = [passengercar_id]
    if pc.InternalID is not None and pc.InternalID not in ids:
        ids.append(pc.InternalID)
    if pc.Model is not None and pc.Model not in ids:
        ids.append(pc.Model)

    rows = db.execute(_TRANSMISSION_SQL, {"ids": ids}).mappings().all()
    return [TecdocTransmissionOut(title=r["title"] or None, value=r["val"]) for r in rows]
