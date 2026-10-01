from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.caldav_account import CaldavAccount
from app.models.organization import Organization
from app.models.user import User
from app.schemas.caldav import CaldavCredentialsView, CaldavStatusView
from app.schemas.organization_employee import (
    OrganizationEmployeeCardCreate,
    OrganizationEmployeeCardPermissionsRequest,
    OrganizationEmployeeCardUpdate,
    OrganizationEmployeeCardView,
    OrganizationEmployeeCreateAccountResponse,
)
from app.services.autoservice_caldav import (
    disconnect_account,
    provision_account,
    regenerate_password,
)
from app.services.organization_employee_service import (
    archive_employee_card,
    create_employee_account,
    create_employee_card,
    get_card_permissions,
    get_card_user_or_409,
    get_employee_card,
    list_employee_cards,
    set_card_permissions,
    update_employee_card,
)
from app.utils.org_access import org_has_admin_director, ADMIN_AUDIT_PERMISSION_CODE
from app.models.permission import Permission

router = APIRouter(prefix="/organizations", tags=["Organization employee cards"])


def _require_director(user: User, org_id: str) -> None:
    if user.organization_id != org_id or not user.is_director:
        raise HTTPException(status_code=403, detail="Доступ запрещён: только директор")


def _require_autoservice_org(db: Session, org_id: str) -> None:
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if (
        not org
        or not getattr(org, "is_autoservice", False)
        or getattr(org, "autoservice_paused", False)
    ):
        raise HTTPException(
            status_code=403,
            detail="Синхронизация календаря доступна только автосервису",
        )


def _card_caldav_account(
    db: Session, org_id: str, card_id: int
) -> tuple[User, CaldavAccount | None]:
    user = get_card_user_or_409(db, org_id, card_id)
    account = (
        db.query(CaldavAccount)
        .filter(
            CaldavAccount.user_id == user.id,
            CaldavAccount.organization_id == org_id,
        )
        .first()
    )
    return user, account


def _card_caldav_account_or_404(
    db: Session, org_id: str, card_id: int
) -> tuple[User, CaldavAccount]:
    user, account = _card_caldav_account(db, org_id, card_id)
    if not account:
        raise HTTPException(status_code=404, detail="CalDAV не подключён")
    return user, account


def _card_caldav_status(account: CaldavAccount | None) -> CaldavStatusView:
    return CaldavStatusView(
        enabled=bool(account),
        configured=settings.CALDAV_SYNC_ENABLED,
        username=account.caldav_username if account else None,
        server_url=settings.CALDAV_PUBLIC_URL if account else None,
        last_synced_at=account.last_synced_at if account else None,
    )


@router.get("/{org_id}/employee-cards", response_model=list[OrganizationEmployeeCardView])
def get_employee_cards(
    org_id: str,
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin and (
        current_user.organization_id != org_id or not current_user.is_director
    ):
        raise HTTPException(status_code=403, detail="Доступ запрещён")
    return list_employee_cards(db, org_id, include_inactive=include_inactive)


@router.post("/{org_id}/employee-cards", response_model=OrganizationEmployeeCardView, status_code=201)
def post_employee_card(
    org_id: str,
    payload: OrganizationEmployeeCardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    return create_employee_card(db, org_id, payload)


@router.put("/{org_id}/employee-cards/{card_id}", response_model=OrganizationEmployeeCardView)
def put_employee_card(
    org_id: str,
    card_id: int,
    payload: OrganizationEmployeeCardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    return update_employee_card(db, org_id, card_id, payload)


@router.delete("/{org_id}/employee-cards/{card_id}", status_code=204)
def delete_employee_card(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    archive_employee_card(db, org_id, card_id)


@router.post(
    "/{org_id}/employee-cards/{card_id}/create-account",
    response_model=OrganizationEmployeeCreateAccountResponse,
)
def post_create_employee_account(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    result = create_employee_account(db, org_id, card_id)
    return OrganizationEmployeeCreateAccountResponse(**result)


@router.get(
    "/{org_id}/employee-cards/{card_id}/calendar-sync",
    response_model=CaldavStatusView,
)
def get_employee_card_calendar_sync(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    _require_autoservice_org(db, org_id)
    card = get_employee_card(db, org_id, card_id)
    account = None
    if card.user_id:
        account = (
            db.query(CaldavAccount)
            .filter(
                CaldavAccount.user_id == card.user_id,
                CaldavAccount.organization_id == org_id,
            )
            .first()
        )
    return _card_caldav_status(account)


@router.post(
    "/{org_id}/employee-cards/{card_id}/calendar-sync",
    response_model=CaldavCredentialsView,
)
def connect_employee_card_calendar_sync(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    _require_autoservice_org(db, org_id)
    user, _ = _card_caldav_account(db, org_id, card_id)
    account, password = provision_account(db, user, org_id)
    db.commit()
    return CaldavCredentialsView(
        server_url=settings.CALDAV_PUBLIC_URL,
        username=account.caldav_username,
        password=password,
    )


@router.post(
    "/{org_id}/employee-cards/{card_id}/calendar-sync/regenerate",
    response_model=CaldavCredentialsView,
)
def regenerate_employee_card_calendar_sync(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    _require_autoservice_org(db, org_id)
    _, account = _card_caldav_account_or_404(db, org_id, card_id)
    password = regenerate_password(db, account)
    db.commit()
    return CaldavCredentialsView(
        server_url=settings.CALDAV_PUBLIC_URL,
        username=account.caldav_username,
        password=password,
    )


@router.delete(
    "/{org_id}/employee-cards/{card_id}/calendar-sync",
    response_model=CaldavStatusView,
)
def disconnect_employee_card_calendar_sync(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    _require_autoservice_org(db, org_id)
    _, account = _card_caldav_account_or_404(db, org_id, card_id)
    disconnect_account(db, account)
    db.commit()
    return _card_caldav_status(None)


@router.get("/{org_id}/employee-cards/{card_id}/permissions", response_model=list[int])
def get_employee_card_permissions(
    org_id: str,
    card_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    return get_card_permissions(db, org_id, card_id)


@router.put("/{org_id}/employee-cards/{card_id}/permissions")
def put_employee_card_permissions(
    org_id: str,
    card_id: int,
    payload: OrganizationEmployeeCardPermissionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_director(current_user, org_id)
    audit_perm = db.query(Permission).filter(Permission.code == ADMIN_AUDIT_PERMISSION_CODE).first()
    if audit_perm and audit_perm.id in payload.permission_ids:
        if not org_has_admin_director(db, org_id):
            raise HTTPException(
                status_code=403,
                detail="Право «Журнал событий» доступно только в организациях с admin-директором",
            )
    set_card_permissions(db, org_id, card_id, payload.permission_ids)
    return {"message": "Permissions assigned successfully"}
