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


def _uniq_positive_ints(*values: int | None) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for v in values:
        if v is None:
            continue
        try:
            iv = int(v)
        except (TypeError, ValueError):
            continue
        if iv not in seen:
            seen.add(iv)
            out.append(iv)
    return out


def _item_ids_for_transmission_attributes(db: Session, pc: TecdocPassengercar) -> list[int]:
    """Ids used to match rows in tecdoc_items_atributes (item_id / ParentLinkitem).

    Includes passengercar, its InternalID/Model, and linked engines (often КПП is on engine items).
    """
    ids = _uniq_positive_ints(pc.id, pc.InternalID, pc.Model)
    engines = (
        db.query(TecdocEngine)
        .join(
            TecdocPassengercarLinkEngine,
            TecdocPassengercarLinkEngine.engine_id == TecdocEngine.id,
        )
        .filter(TecdocPassengercarLinkEngine.car_id == pc.id)
        .all()
    )
    for eng in engines:
        ids.extend(_uniq_positive_ints(eng.id, eng.InternalID))
    # preserve first occurrence order, dedupe again
    return _uniq_positive_ints(*ids)


# Transmission-related rows in tecdoc_items_atributes: ILIKE works for Latin and Cyrillic case folding.
_TRANSMISSION_SQL = text(
    """
    SELECT DISTINCT
        COALESCE("DisplayTitle", '') AS title,
        COALESCE("DisplayValue", '') AS val
    FROM tecdoc_items_atributes
    WHERE (item_id IN :ids OR "ParentLinkitem" IN :ids)
      AND COALESCE(TRIM(COALESCE("DisplayValue", '')), '') <> ''
      AND (
        COALESCE("AttributeGroup", '') ILIKE '%trans%'
        OR COALESCE("AttributeGroup", '') ILIKE '%gear%'
        OR COALESCE("AttributeGroup", '') ILIKE '%getrieb%'
        OR COALESCE("AttributeType", '') ILIKE '%trans%'
        OR COALESCE("AttributeType", '') ILIKE '%gear%'
        OR COALESCE("AttributeType", '') ILIKE '%getrieb%'
        OR COALESCE("DisplayTitle", '') ILIKE '%короб%'
        OR COALESCE("DisplayTitle", '') ILIKE '%кпп%'
        OR COALESCE("DisplayTitle", '') ILIKE '%акпп%'
        OR COALESCE("DisplayTitle", '') ILIKE '%мкпп%'
        OR COALESCE("DisplayTitle", '') ILIKE '%gear%'
        OR COALESCE("DisplayTitle", '') ILIKE '%trans%'
        OR COALESCE("DisplayTitle", '') ILIKE '%getrieb%'
        OR COALESCE("DisplayTitle", '') ILIKE '%schalt%'
        OR COALESCE("DisplayTitle", '') ILIKE '%tiptron%'
        OR COALESCE("DisplayTitle", '') ILIKE '%powershift%'
        OR COALESCE("DisplayTitle", '') ILIKE '%multitron%'
        OR COALESCE("DisplayTitle", '') ILIKE '%stronic%'
        OR COALESCE("DisplayTitle", '') ILIKE '%dct%'
        OR COALESCE("DisplayTitle", '') ILIKE '%cvt%'
        OR COALESCE("DisplayValue", '') ILIKE '%akpp%'
        OR COALESCE("DisplayValue", '') ILIKE '%акпп%'
        OR COALESCE("DisplayValue", '') ILIKE '%мкпп%'
        OR COALESCE("DisplayValue", '') ILIKE '%кпп%'
        OR COALESCE("DisplayValue", '') ILIKE '%вариатор%'
        OR COALESCE("DisplayValue", '') ILIKE '%cvt%'
        OR COALESCE("DisplayValue", '') ILIKE '%dsg%'
        OR COALESCE("DisplayValue", '') ILIKE '%dct%'
        OR COALESCE("DisplayValue", '') ILIKE '%amt%'
        OR COALESCE("DisplayValue", '') ILIKE '%автомат%'
        OR COALESCE("DisplayValue", '') ILIKE '%механ%'
        OR COALESCE("DisplayValue", '') ILIKE '%robot%'
        OR COALESCE("DisplayValue", '') ILIKE '%tiptron%'
        OR COALESCE("DisplayValue", '') ILIKE '%powershift%'
        OR COALESCE("DisplayValue", '') ILIKE '%manual%'
        OR COALESCE("DisplayValue", '') ILIKE '%automatic%'
        OR COALESCE("DisplayValue", '') ILIKE '%ступен%'
        OR COALESCE("LinkitemType", '') ILIKE '%trans%'
        OR COALESCE("LinkitemType", '') ILIKE '%gear%'
        OR COALESCE("LinkitemType", '') ILIKE '%getrieb%'
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

    ids = _item_ids_for_transmission_attributes(db, pc)
    rows = db.execute(_TRANSMISSION_SQL, {"ids": ids}).mappings().all()
    return [TecdocTransmissionOut(title=r["title"] or None, value=r["val"]) for r in rows]
