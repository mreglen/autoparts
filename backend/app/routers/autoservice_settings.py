from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_settings import AutoserviceSettings
from app.models.user import User
from app.schemas.autoservice_settings import AutoserviceSettingsUpdate, AutoserviceSettingsView
from app.utils.autoservice_access import require_autoservice_director

router = APIRouter(tags=["Autoservice settings"])


def _get_or_create_settings(db: Session, org_id: str) -> AutoserviceSettings:
    row = (
        db.query(AutoserviceSettings)
        .filter(AutoserviceSettings.organization_id == org_id)
        .first()
    )
    if row:
        return row
    row = AutoserviceSettings(organization_id=org_id, lifts_count=0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/autoservice/settings", response_model=AutoserviceSettingsView)
def get_autoservice_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    return AutoserviceSettingsView.model_validate(_get_or_create_settings(db, org_id))


@router.put("/autoservice/settings", response_model=AutoserviceSettingsView)
def update_autoservice_settings(
    payload: AutoserviceSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = require_autoservice_director(db, current_user)
    row = _get_or_create_settings(db, org_id)
    row.lifts_count = payload.lifts_count
    db.commit()
    db.refresh(row)
    return AutoserviceSettingsView.model_validate(row)
