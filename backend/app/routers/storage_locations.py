from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.models.storage_location import StorageLocation as StorageLocationModel  
from app.schemas.storage_location import StorageLocation as StorageLocationSchema, StorageLocationCreate  
from app.db.database import get_db

router = APIRouter(prefix="/storage-locations", tags=["Storage Locations"])

@router.post("/", response_model=StorageLocationSchema)
def create_storage_location(loc: StorageLocationCreate, db: Session = Depends(get_db)):
    db_loc = StorageLocationModel(**loc.dict())
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    return db_loc
# 
@router.get("/{loc_id}", response_model=StorageLocationSchema)
def read_storage_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Склад не найден")
    return loc

@router.put("/{loc_id}", response_model=StorageLocationSchema)
def update_storage_location(loc_id: int, loc: StorageLocationCreate, db: Session = Depends(get_db)):
    db_loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not db_loc:
        raise HTTPException(status_code=404, detail="Склад не найден")

    for key, value in loc.dict().items():
        setattr(db_loc, key, value)

    db.commit()
    db.refresh(db_loc)
    return db_loc

@router.delete("/{loc_id}", status_code=204)
def delete_storage_location(loc_id: int, db: Session = Depends(get_db)):
    db_loc = db.query(StorageLocationModel).filter(StorageLocationModel.id == loc_id).first()
    if not db_loc:
        raise HTTPException(status_code=404, detail="Склад не найден")

    db.delete(db_loc)
    db.commit()
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