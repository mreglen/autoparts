from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.models.caldav_account import CaldavAccount
from app.models.user import User
from app.core.auth import get_current_user
from app.schemas.caldav import CaldavCredentialsView, CaldavStatusView
from app.services.autoservice_caldav import (
    disconnect_account,
    provision_account,
    regenerate_password,
)
from app.utils.autoservice_access import (
    AUTOSERVICE_PERMISSION_PLANNER,
    require_autoservice_permission,
)

router = APIRouter(tags=["Autoservice CalDAV"])


def _account_or_404(db: Session, user: User, org_id: str) -> CaldavAccount:
    account = (
        db.query(CaldavAccount)
        .filter(
            CaldavAccount.user_id == user.id,
            CaldavAccount.organization_id == org_id,
        )
        .first()
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CalDAV не подключён",
        )
    return account


@router.get("/autoservice/calendar-sync", response_model=CaldavStatusView)
def get_calendar_sync_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    account = (
        db.query(CaldavAccount)
        .filter(
            CaldavAccount.user_id == current_user.id,
            CaldavAccount.organization_id == org_id,
        )
        .first()
    )
    return CaldavStatusView(
        enabled=bool(account),
        configured=settings.CALDAV_SYNC_ENABLED,
        username=account.caldav_username if account else None,
        server_url=settings.CALDAV_PUBLIC_URL if account else None,
        last_synced_at=account.last_synced_at if account else None,
    )


@router.post("/autoservice/calendar-sync/connect", response_model=CaldavCredentialsView)
def connect_calendar_sync(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    account, password = provision_account(db, current_user, org_id)
    db.commit()
    return CaldavCredentialsView(
        server_url=settings.CALDAV_PUBLIC_URL,
        username=account.caldav_username,
        password=password,
    )


@router.post("/autoservice/calendar-sync/regenerate", response_model=CaldavCredentialsView)
def regenerate_calendar_sync_password(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    account = _account_or_404(db, current_user, org_id)
    password = regenerate_password(db, account)
    db.commit()
    return CaldavCredentialsView(
        server_url=settings.CALDAV_PUBLIC_URL,
        username=account.caldav_username,
        password=password,
    )


@router.delete("/autoservice/calendar-sync", response_model=CaldavStatusView)
def disconnect_calendar_sync(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = require_autoservice_permission(db, current_user, AUTOSERVICE_PERMISSION_PLANNER)
    account = _account_or_404(db, current_user, org_id)
    disconnect_account(db, account)
    db.commit()
    return CaldavStatusView(enabled=False, configured=settings.CALDAV_SYNC_ENABLED)
