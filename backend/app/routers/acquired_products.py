from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.acquired_product import AcquiredProduct as AcquiredProductModel
from app.schemas.acquired_product import AcquiredProduct as AcquiredProductSchema, AcquiredProductCreate
from app.db.database import get_db

router = APIRouter(prefix="/acquired-products", tags=["Acquired Products"])

@router.post("/", response_model=AcquiredProductSchema)
def create_acquired_product(acq: AcquiredProductCreate, db: Session = Depends(get_db)):
    db_acq = AcquiredProductModel(**acq.dict())
    db.add(db_acq)
    db.commit()
    db.refresh(db_acq)
    return db_acq

@router.get("/{acq_id}", response_model=AcquiredProductSchema)
def read_acquired_product(acq_id: int, db: Session = Depends(get_db)):
    acq = db.query(AcquiredProductModel).filter(AcquiredProductModel.id == acq_id).first()
    if not acq:
        raise HTTPException(status_code=404, detail="Acquired product not found")
    return acq

@router.put("/{acq_id}", response_model=AcquiredProductSchema)
def update_acquired_product(acq_id: int, acq: AcquiredProductCreate, db: Session = Depends(get_db)):
    db_acq = db.query(AcquiredProductModel).filter(AcquiredProductModel.id == acq_id).first()
    if not db_acq:
        raise HTTPException(status_code=404, detail="Acquired product not found")

    for key, value in acq.dict().items():
        setattr(db_acq, key, value)

    db.commit()
    db.refresh(db_acq)
    return db_acq

@router.delete("/{acq_id}", status_code=204)
def delete_acquired_product(acq_id: int, db: Session = Depends(get_db)):
    db_acq = db.query(AcquiredProductModel).filter(AcquiredProductModel.id == acq_id).first()
    if not db_acq:
        raise HTTPException(status_code=404, detail="Acquired product not found")

    db.delete(db_acq)
    db.commit()
    return