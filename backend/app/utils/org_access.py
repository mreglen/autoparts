from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models.organization import Organization
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


def can_see_rossko_warehouse_names(db: Session | None, user: object | None) -> bool:
    """Warehouse names are visible to staff of the main org (director is_admin) and platform admins."""
    if not user:
        return False
    if bool(getattr(user, "is_admin", False)):
        return True
    org_id = getattr(user, "organization_id", None)
    if not org_id or db is None:
        return False
    if not org_has_admin_director(db, org_id):
        return False
    return bool(
        getattr(user, "is_seller", False)
        or getattr(user, "is_director", False)
        or getattr(user, "is_employee", False)
    )


def resolve_autoservice_organization_id(db: Session) -> Optional[str]:
    """Organization flagged as autoservice in organizations.is_autoservice."""
    row = (
        db.query(Organization.id)
        .filter(
            Organization.is_autoservice.is_(True),
            Organization.autoservice_paused.is_(False),
        )
        .order_by(Organization.id)
        .first()
    )
    if row:
        return row[0]
    return None
