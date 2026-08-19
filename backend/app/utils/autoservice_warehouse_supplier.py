"""Display rules for autoservice warehouse purchase suppliers."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.garage_new_orders import GarageNewOrder

ADMIN_MARKETPLACE_ORG_ID = "TVgpq7hgzd"
ROSSKO_SUPPLIER_LABEL = "Росско"


def is_admin_marketplace_rossko_new_order(
    db: Session,
    *,
    source_order_type: str | None,
    source_order_id: int | None,
) -> bool:
    if source_order_type != "new" or not source_order_id:
        return False
    order = (
        db.query(GarageNewOrder)
        .filter(GarageNewOrder.id == int(source_order_id))
        .first()
    )
    return bool(order and order.organization_id == ADMIN_MARKETPLACE_ORG_ID)


def resolve_autoservice_supplier_display_name(
    db: Session,
    *,
    supplier_name: str,
    source_order_type: str | None = None,
    source_order_id: int | None = None,
) -> str:
    if is_admin_marketplace_rossko_new_order(
        db,
        source_order_type=source_order_type,
        source_order_id=source_order_id,
    ):
        return ROSSKO_SUPPLIER_LABEL
    return supplier_name or "Поставщик"
