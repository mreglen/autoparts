# app/routers/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.event_log import EventLog
from app.models.user import User
from app.models.organization import Organization
from app.db.database import get_db
from app.schemas.event_log import EventLogResponse
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.organization import Organization as OrganizationSchema, OrganizationCreate, OrganizationUpdate
from typing import List
from app.core.auth import get_current_admin_user 

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users


@router.get("/events", response_model=List[EventLogResponse])
def get_event_log(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    events = db.query(EventLog).order_by(EventLog.created_at.desc()).all()
    return events

@router.get("/organizations", response_model=List[OrganizationSchema])
def get_all_organizations(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    organizations = db.query(Organization).all()
    return organizations

@router.put("/organizations/{org_id}", response_model=OrganizationSchema)
def update_organization_admin(
    org_id: str,
    org_update: OrganizationUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Организация не найдена")

    # Обновляем поля
    update_data = org_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(org, key, value)

    db.commit()
    db.refresh(org)
    return org