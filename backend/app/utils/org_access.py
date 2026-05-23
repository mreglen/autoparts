from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User as UserModel

ADMIN_AUDIT_PERMISSION_CODE = "admin.audit"
SETTINGS_INTEGRATION_AVITO_PERMISSION_CODE = "settings.integration.avito"


def org_has_admin_director(db: Session, org_id: Optional[str]) -> bool:
    """Organization has a director with is_director and is_admin both true."""
    if not org_id:
        return False
    q = db.query(UserModel.id).filter(
        UserModel.organization_id == org_id,
        UserModel.is_director == True,  # noqa: E712
        UserModel.is_admin == True,  # noqa: E712
    )
    return db.query(q.exists()).scalar() is True
