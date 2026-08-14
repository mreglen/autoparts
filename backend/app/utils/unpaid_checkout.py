"""Who may place new-parts orders without YooKassa payment."""
from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.user import User as UserModel


def user_allows_unpaid_checkout(db: Session, user: UserModel) -> bool:
    org_id = getattr(user, "organization_id", None)
    if not org_id:
        return False
    org = db.query(Organization).filter(Organization.id == org_id).first()
    return bool(org and org.allow_unpaid_checkout)
