from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.storage_location import StorageLocation as StorageLocationModel
from app.models.user import User
from app.schemas.storage_location import StorageLocation as StorageLocationSchema, StorageLocationCreate
from app.services.audit_service import log_audit
from app.services.geocode_storage_location import reset_geocode_fields

router = APIRouter(prefix="/storage-locations", tags=["Storage Locations"])
logger = logging.getLogger(__name__)


def _payload_dict(loc: StorageLocationCreate) -> dict:
    return loc.model_dump() if hasattr(loc, "model_dump") else loc.dict()


def _location_label(loc: StorageLocationModel) -> str:
    return (getattr(loc, "address", None) or "").strip() or f"#{loc.id}"


def _require_org_access(current_user: User, organization_id: str) -> None:
    if current_user.is_admin:
        return
    if not current_user.organization_id or current_user.organization_id != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к этой организации")


def _has_client_coords(data: dict) -> bool:
    lat = data.get("latitude")
    lng = data.get("longitude")
    return lat is not None and lng is not None


def _apply_client_coords(db_loc: StorageLocationModel, data: dict) -> None:
    if not _has_client_coords(data):
        return
    db_loc.latitude = float(data["latitude"])
    db_loc.longitude = float(data["longitude"])
    db_loc.geocoded_at = datetime.now(timezone.utc).replace(tzinfo=None)


def _enqueue_storage_location_geocode(location_id: int) -> None:
    try:
        from app.tasks.geocode_tasks import geocode_storage_location_task

        geocode_storage_location_task.delay(int(location_id))
    except Exception as exc:
        logger.warning("Failed to enqueue geocode for storage location %s: %s", location_id, exc)


@router.post("/", response_model=StorageLocationSchema)
def create_storage_location(
    loc: StorageLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = _payload_dict(loc)
    if not current_user.is_admin:
        if not current_user.organization_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа")
        data["organization_id"] = current_user.organization_id
    _require_org_access(current_user, data["organization_id"])

    address = (data.get("address") or "").strip()
    if not address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите адрес склада")

    db_loc = StorageLocationModel(
        address=address,
        organization_id=data["organization_id"],
    )
    _apply_client_coords(db_loc, data)
    db.add(db_loc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Не удалось создать склад")
    db.refresh(db_loc)

    if not _has_client_coords(data):
        _enqueue_storage_location_geocode(db_loc.id)

    log_audit(
        db,
        event_type="storage_location_created",
        category="settings",
        summary=f"Создан склад: {_location_label(db_loc)}",
        user=current_user,
        organization_id=db_loc.organization_id,
        details={"storage_location_id": db_loc.id, "address": db_loc.address},
        entity_type="storage_location",
        entity_id=db_loc.id,
    )
    return db_loc


@router.get("/{loc_id}", response_model=StorageLocationSchema)
def read_storage_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Склад не найден")
    return loc


@router.put("/{loc_id}", response_model=StorageLocationSchema)
def update_storage_location(
    loc_id: int,
    loc: StorageLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not db_loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Склад не найден")
    _require_org_access(current_user, db_loc.organization_id)

    data = _payload_dict(loc)
    address = (data.get("address") or "").strip()
    if not address:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Укажите адрес склада")

    old_address = (db_loc.address or "").strip()
    address_changed = old_address != address
    if address_changed:
        reset_geocode_fields(db_loc)

    db_loc.address = address
    if current_user.is_admin and data.get("organization_id"):
        db_loc.organization_id = data["organization_id"]

    _apply_client_coords(db_loc, data)

    db.commit()
    db.refresh(db_loc)

    if not _has_client_coords(data) and (db_loc.latitude is None or db_loc.longitude is None):
        _enqueue_storage_location_geocode(db_loc.id)

    log_audit(
        db,
        event_type="storage_location_updated",
        category="settings",
        summary=f"Обновлён склад #{loc_id}: {_location_label(db_loc)}",
        user=current_user,
        organization_id=db_loc.organization_id,
        details={"storage_location_id": db_loc.id, "address": db_loc.address},
        entity_type="storage_location",
        entity_id=db_loc.id,
    )
    return db_loc


@router.delete("/{loc_id}", status_code=204)
def delete_storage_location(
    loc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not db_loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Склад не найден")
    _require_org_access(current_user, db_loc.organization_id)

    org_id = db_loc.organization_id
    label = _location_label(db_loc)
    db.delete(db_loc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить склад: к нему привязаны товары или документы. Сначала перенесите или удалите их.",
        )
    log_audit(
        db,
        event_type="storage_location_deleted",
        category="settings",
        summary=f"Удалён склад #{loc_id}: {label}",
        user=current_user,
        organization_id=org_id,
        details={"storage_location_id": loc_id, "address": label},
        entity_type="storage_location",
        entity_id=loc_id,
    )
    return


@router.get("/", response_model=list[StorageLocationSchema])
def read_storage_locations_by_org(
    organization_id: str = Query(..., alias="organization_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_org_access(current_user, organization_id)
    return (
        db.query(StorageLocationModel)
        .filter(StorageLocationModel.organization_id == organization_id)
        .order_by(StorageLocationModel.id.asc())
        .all()
    )
