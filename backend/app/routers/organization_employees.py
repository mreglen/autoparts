from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.organization_employee import (
    OrganizationEmployeeCardCreate,
    OrganizationEmployeeCardPermissionsRequest,
    OrganizationEmployeeCardUpdate,
    OrganizationEmployeeCardView,
    OrganizationEmployeeCreateAccountResponse,
)
from app.services.organization_employee_service import (
    archive_employee_card,
    create_employee_account,
    create_employee_card,
    get_card_permissions,
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
