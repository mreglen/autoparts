"""Resolve purchase order lines visible to the current buyer."""
from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.user import User
from app.utils.client_buyers import order_visible_to_buyer


def used_order_buyer_visibility_filter(user: User):
    filters = [GarageUsedOrder.user_id == user.id]
    email = (user.email or "").strip()
    if email:
        filters.append(GarageUsedOrder.buyer_email == email)
    return or_(*filters)


def fetch_used_purchase_items_for_buyer(
    db: Session,
    *,
    user: User,
    item_ids: list[int],
) -> list[GarageUsedOrderItem]:
    """Load used purchase lines visible to the buyer (user_id or legacy email match)."""
    if not item_ids:
        return []
    target_email = user.email or ""
    target_phone = user.phone or ""
    rows = (
        db.query(GarageUsedOrderItem)
        .join(GarageUsedOrder, GarageUsedOrderItem.order_id == GarageUsedOrder.id)
        .options(
            joinedload(GarageUsedOrderItem.product),
            joinedload(GarageUsedOrderItem.order),
        )
        .filter(
            GarageUsedOrderItem.id.in_(item_ids),
            used_order_buyer_visibility_filter(user),
        )
        .all()
    )
    return [
        row
        for row in rows
        if order_visible_to_buyer(row.order, user.id, target_email, target_phone)
    ]
