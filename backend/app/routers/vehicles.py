from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.vehicle import Vehicle as VehicleModel
from app.schemas.vehicle import Vehicle as VehicleSchema, VehicleCreate
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

@router.get("/", response_model=list[VehicleSchema])
def get_vehicles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    vehicles = db.query(VehicleModel).filter(
        VehicleModel.organization_id == current_user.organization_id
    ).all()
    return vehicles


@router.post("/", response_model=VehicleSchema)
def create_vehicle(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    
    db_vehicle = VehicleModel(
        **vehicle.model_dump(),  # Pydantic v2; если v1 — vehicle.dict()
        organization_id=current_user.organization_id
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle