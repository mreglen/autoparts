from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.models.part_type import PartType as PartTypeModel
from app.schemas.part_type import PartType as PartTypeSchema
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/part-types", tags=["Part Types"])

@router.get("/", response_model=list[PartTypeSchema])
def get_part_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить все виды запчастей"""
    return db.query(PartTypeModel).order_by(PartTypeModel.name).all()
