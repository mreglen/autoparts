from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.utils.org_access import SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE


def has_avito_integration_access(db: Session, user: UserModel) -> bool:
    if user.is_admin or user.is_seller or user.is_director:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(
            UserPermission.user_id == user.id,
            Permission.code == SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE,
        )
    )
    return db.query(q.exists()).scalar() is True


def ensure_avito_integration_access(db: Session, user: UserModel, org_id: str) -> None:
    if user.organization_id != org_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к организации")
    if not has_avito_integration_access(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к интеграции Авито",
        )


def ensure_org_member(user: UserModel, org_id: str) -> None:
    if user.organization_id != org_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к организации")
