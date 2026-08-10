from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.autoservice_settings import AutoserviceSettings
from app.models.organization import Organization
from app.models.user import User
from app.schemas.autoservice_settings import (
    AutoservicePublicInfo,
    AutoserviceSettingsUpdate,
    AutoserviceSettingsView,
)
from app.utils.autoservice_access import require_autoservice_director
from app.utils.org_access import resolve_autoservice_organization_id
from app.utils.site_settings_db import autoservice_enabled

router = APIRouter(tags=["Autoservice settings"])


def _get_or_create_settings(db: Session, org_id: str) -> AutoserviceSettings:
    row = (
        db.query(AutoserviceSettings)
        .filter(AutoserviceSettings.organization_id == org_id)
        .first()
    )
    if row:
        return row
    row = AutoserviceSettings(organization_id=org_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/public/autoservice/info", response_model=AutoservicePublicInfo)
def get_public_autoservice_info(db: Session = Depends(get_db)):
    if not autoservice_enabled(db):
        return AutoservicePublicInfo(enabled=False)
    org_id = resolve_autoservice_organization_id(db)
    if not org_id:
        return AutoservicePublicInfo(enabled=False)
    org = db.query(Organization).filter(Organization.id == org_id).first()
    settings = (
        db.query(AutoserviceSettings)
        .filter(AutoserviceSettings.organization_id == org_id)
        .first()
    )
    name = (settings.public_name if settings else None) or (org.name if org else None)
    return AutoservicePublicInfo(
        enabled=True,
        name=name,
        description=settings.public_description if settings else None,
        address=org.address if org else None,
        phone=org.phone if org else None,
    )


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
    if "public_name" in payload.model_fields_set:
        row.public_name = (payload.public_name or "").strip() or None
    if "public_description" in payload.model_fields_set:
        row.public_description = (payload.public_description or "").strip() or None
    db.commit()
    db.refresh(row)
    return AutoserviceSettingsView.model_validate(row)
