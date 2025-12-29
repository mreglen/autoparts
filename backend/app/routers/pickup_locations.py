from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.pickup_location import PickupLocation as PickupLocationModel
from app.schemas.pickup_location import PickupLocation as PickupLocationSchema, PickupLocationCreate
from app.db.database import get_db

router = APIRouter(prefix="/pickup-locations", tags=["Pickup Locations"])

@router.post("/", response_model=PickupLocationSchema)
def create_pickup_location(loc: PickupLocationCreate, db: Session = Depends(get_db)):
    db_loc = PickupLocationModel(**loc.dict())
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    return db_loc

@router.get("/{loc_id}", response_model=PickupLocationSchema)
def read_pickup_location(loc_id: int, db: Session = Depends(get_db)):
    loc = db.query(PickupLocationModel).filter(PickupLocationModel.id == loc_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Pickup location not found")
    return loc

@router.put("/{loc_id}", response_model=PickupLocationSchema)
def update_pickup_location(loc_id: int, loc: PickupLocationCreate, db: Session = Depends(get_db)):
    db_loc = db.query(PickupLocationModel).filter(PickupLocationModel.id == loc_id).first()
    if not db_loc:
        raise HTTPException(status_code=404, detail="Pickup location not found")

    for key, value in loc.dict().items():
        setattr(db_loc, key, value)

    db.commit()
    db.refresh(db_loc)
    return db_loc

@router.delete("/{loc_id}", status_code=204)
def delete_pickup_location(loc_id: int, db: Session = Depends(get_db)):
    db_loc = db.query(PickupLocationModel).filter(PickupLocationModel.id == loc_id).first()
    if not db_loc:
        raise HTTPException(status_code=404, detail="Pickup location not found")

    db.delete(db_loc)
    db.commit()
    return