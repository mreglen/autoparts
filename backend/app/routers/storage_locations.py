from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.models.storage_location import StorageLocation as StorageLocationModel  
from app.schemas.storage_location import StorageLocation as StorageLocationSchema, StorageLocationCreate  
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.services.audit_service import log_audit

router = APIRouter(prefix="/storage-locations", tags=["Storage Locations"])

@router.post("/", response_model=StorageLocationSchema)
def create_storage_location(
    loc: StorageLocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_loc = StorageLocationModel(**loc.dict())
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    log_audit(
        db,
        event_type="storage_location_created",
        category="settings",
        summary=f"Создан склад: {db_loc.name or db_loc.address or db_loc.id}",
        user=current_user,
        organization_id=db_loc.organization_id,
        details={"storage_location_id": db_loc.id, "name": db_loc.name, "address": db_loc.address},
        entity_type="storage_location",
        entity_id=db_loc.id,
    )
    return db_loc

@router.get("/{loc_id}", response_model=StorageLocationSchema)
def read_storage_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Склад не найден")
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
        raise HTTPException(status_code=404, detail="Склад не найден")

    for key, value in loc.dict().items():
        setattr(db_loc, key, value)

    db.commit()
    db.refresh(db_loc)
    log_audit(
        db,
        event_type="storage_location_updated",
        category="settings",
        summary=f"Обновлён склад #{loc_id}: {db_loc.name or db_loc.address or ''}",
        user=current_user,
        organization_id=db_loc.organization_id,
        details={"storage_location_id": db_loc.id, "name": db_loc.name, "address": db_loc.address},
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
        raise HTTPException(status_code=404, detail="Склад не найден")

    org_id = db_loc.organization_id
    name = db_loc.name or db_loc.address
    db.delete(db_loc)
    db.commit()
    log_audit(
        db,
        event_type="storage_location_deleted",
        category="settings",
        summary=f"Удалён склад #{loc_id}: {name or ''}",
        user=current_user,
        organization_id=org_id,
        details={"storage_location_id": loc_id, "name": name},
        entity_type="storage_location",
        entity_id=loc_id,
    )
    return

@router.get("/", response_model=list[StorageLocationSchema])
def read_storage_locations_by_org(
    organization_id: str = Query(..., alias="organization_id"), 
    db: Session = Depends(get_db)
):
    locations = db.query(StorageLocationModel).filter(
        StorageLocationModel.organization_id == organization_id
    ).all()
    return locations
