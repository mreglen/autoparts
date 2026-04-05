from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.transmission import Transmission

router = APIRouter(prefix="/transmissions", tags=["Transmissions"])


class TransmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sort_order: int


@router.get("/", response_model=list[TransmissionOut])
def list_transmissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(Transmission)
        .order_by(Transmission.sort_order.asc(), Transmission.id.asc())
        .all()
    )
    return rows
