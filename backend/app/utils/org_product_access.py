"""Organization-scoped product access for warehouse / QR flows."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.permission import Permission
from app.models.product import Product as ProductModel
from app.models.user import User
from app.models.user_permission import UserPermission

WAREHOUSE_QR_PERMISSIONS: tuple[str, ...] = (
    "my-parts",
    "stock-in",
    "stock-out",
    "warehouse-sales",
)

STOCK_IN_PERMISSION = "stock-in"
PRINT_PERMISSION = "settings.printers"


def _user_has_permission_code(db: Session, user: User, code: str) -> bool:
    if user.is_admin or user.is_seller or user.is_director:
        return True
    if not user.is_employee:
        return False
    exists = (
        db.query(Permission.id)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(
            UserPermission.user_id == user.id,
            Permission.code == code,
        )
        .first()
    )
    return exists is not None


def user_has_any_permission(db: Session, user: User, codes: tuple[str, ...]) -> bool:
    if user.is_admin or user.is_seller or user.is_director:
        return True
    if not user.is_employee:
        return False
    return any(_user_has_permission_code(db, user, code) for code in codes)


def user_can_access_qr_part_card(db: Session, user: User | None) -> bool:
    if not user or not user.organization_id:
        return False
    if user.is_admin or user.is_seller:
        return True
    if user.is_employee:
        return user_has_any_permission(db, user, WAREHOUSE_QR_PERMISSIONS)
    return False


def user_can_access_org_product(user: User, product: ProductModel | None) -> bool:
    if not user or not product or not user.organization_id:
        return False
    return str(product.organization_id or "") == str(user.organization_id)


def user_can_create_stock_in(db: Session, user: User | None) -> bool:
    if not user or not user.organization_id:
        return False
    if user.is_admin or user.is_seller:
        return True
    if user.is_employee:
        return _user_has_permission_code(db, user, STOCK_IN_PERMISSION)
    return False
