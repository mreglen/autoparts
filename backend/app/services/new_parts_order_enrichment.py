"""Обогащение заказов новых запчастей данными поставщика (Rossko GetOrders)."""
from __future__ import annotations

from typing import Callable, Optional

from sqlalchemy.orm import Session

from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.schemas.sales_orders import (
    NewPartsOrderItemResponse,
    NewPartsOrderResponse,
    PurchasedNewOrderItemResponse,
    PurchasedNewOrderResponse,
)
from app.services.rossko_get_orders_service import (
    RosskoOrderLine,
    RosskoOrderSnapshot,
    fetch_orders_by_ids_safe,
)
from app.services.pickup_verification_service import (
    NEW_PICKUP_READY_STATUS,
    get_buyer_pickup_payload,
)
from app.services.rossko_status_labels import (
    NEW_PARTS_STATUS_PRIORITY,
    format_rossko_status,
    map_rossko_line_status_to_new_parts_status_code,
)

SELLER_LOCKED_NEW_PARTS_STATUSES = frozenset(
    {
        NEW_PICKUP_READY_STATUS,
        "new_received",
        "rejected",
    }
)


def item_match_key(brand: str | None, partnumber: str | None) -> tuple[str, str]:
    return ((partnumber or "").strip().lower(), (brand or "").strip().lower())


def collect_rossko_order_ids(orders: list[GarageNewOrder]) -> list[int]:
    ids: list[int] = []
    for order in orders:
        if not order.rossko_order_id:
            continue
        try:
            ids.append(int(str(order.rossko_order_id).strip()))
        except ValueError:
            continue
    return ids


def fetch_rossko_snapshots_for_orders(
    orders: list[GarageNewOrder],
) -> tuple[dict[str, RosskoOrderSnapshot], str | None]:
    return fetch_orders_by_ids_safe(collect_rossko_order_ids(orders))


def per_order_sync_error(
    snapshot: RosskoOrderSnapshot | None,
    global_error: str | None,
) -> str | None:
    if snapshot and not snapshot.lines:
        return "Позиции поставщика не найдены"
    if global_error:
        return global_error
    return None


def _rossko_lines_by_key(snapshot: RosskoOrderSnapshot | None) -> dict[tuple[str, str], RosskoOrderLine]:
    out: dict[tuple[str, str], RosskoOrderLine] = {}
    if snapshot and snapshot.lines:
        for line in snapshot.lines:
            out[item_match_key(line.brand, line.partnumber)] = line
    return out


def _display_status_from_rossko_line(
    db_status: str,
    line: RosskoOrderLine | None,
    *,
    for_seller: bool = False,
) -> str:
    if for_seller and db_status in SELLER_LOCKED_NEW_PARTS_STATUSES:
        return db_status
    if not line:
        return db_status
    mapped = map_rossko_line_status_to_new_parts_status_code(
        line.status_code,
        for_seller=for_seller,
    )
    return mapped or db_status


def aggregate_status_from_codes(codes: list[str], *, default: str) -> str:
    filtered = [c for c in codes if c]
    if not filtered:
        return default
    return min(filtered, key=lambda c: NEW_PARTS_STATUS_PRIORITY.get(c, 999))


def apply_rossko_statuses_to_order(
    order: GarageNewOrder,
    snapshot: RosskoOrderSnapshot | None,
) -> bool:
    """Пишет статусы Rossko в БД. Не трогает «К выдаче» / «Получен»."""
    if not snapshot or not snapshot.lines:
        return False
    if order.status_code in (NEW_PICKUP_READY_STATUS, "new_received"):
        return False

    rossko_by_key = _rossko_lines_by_key(snapshot)
    changed = False
    for item in order.items:
        if item.status_code in SELLER_LOCKED_NEW_PARTS_STATUSES:
            continue
        line = rossko_by_key.get(item_match_key(item.brand, item.partnumber))
        mapped = _display_status_from_rossko_line(item.status_code, line, for_seller=True)
        if mapped != item.status_code:
            item.status_code = mapped
            changed = True

    new_order_status = aggregate_status_from_codes(
        [item.status_code for item in order.items],
        default=order.status_code or "new_waiting_confirmation",
    )
    if new_order_status != order.status_code:
        order.status_code = new_order_status
        changed = True
    return changed


def persist_rossko_supplier_statuses(
    orders: list[GarageNewOrder],
    rossko_by_id: dict[str, RosskoOrderSnapshot],
    sync_error: str | None,
) -> bool:
    if sync_error:
        return False
    changed = False
    for order in orders:
        rossko_id = order.rossko_order_id
        if not rossko_id:
            continue
        snapshot = rossko_by_id.get(str(rossko_id))
        if apply_rossko_statuses_to_order(order, snapshot):
            changed = True
    return changed


def orders_pending_rossko_sync(orders: list[GarageNewOrder]) -> list[GarageNewOrder]:
    return [
        order
        for order in orders
        if order.rossko_order_id
        and order.status_code not in (NEW_PICKUP_READY_STATUS, "new_received")
    ]


def sync_active_rossko_supplier_statuses(
    orders: list[GarageNewOrder],
) -> tuple[dict[str, RosskoOrderSnapshot], str | None]:
    """GetOrders только для активных заказов. Список страниц это не вызывает."""
    pending = orders_pending_rossko_sync(orders)
    if not pending:
        return {}, None
    snapshots, err = fetch_rossko_snapshots_for_orders(pending)
    persist_rossko_supplier_statuses(pending, snapshots, err)
    return snapshots, err


def merge_seller_items_with_rossko(
    db: Session,
    order: GarageNewOrder,
    snapshot: RosskoOrderSnapshot | None,
    *,
    resolve_seo_card_id: Callable[[Session, GarageNewOrderItem], int | None],
) -> list[NewPartsOrderItemResponse]:
    rossko_by_key = _rossko_lines_by_key(snapshot)
    merged: list[NewPartsOrderItemResponse] = []
    for item in order.items:
        line = rossko_by_key.get(item_match_key(item.brand, item.partnumber))
        merged.append(
            NewPartsOrderItemResponse(
                id=item.id,
                name=item.name,
                brand=item.brand,
                partnumber=item.partnumber,
                quantity=int(item.quantity),
                price=float(item.price),
                status_code=_display_status_from_rossko_line(
                    item.status_code,
                    line,
                    for_seller=True,
                ),
                rossko_status=format_rossko_status(line.status_code) if line else None,
                seo_card_id=resolve_seo_card_id(db, item),
            )
        )
    return merged


def merge_buyer_items_with_rossko(
    db: Session,
    order: GarageNewOrder,
    snapshot: RosskoOrderSnapshot | None,
    *,
    resolve_seo_card_id: Callable[[Session, GarageNewOrderItem], int | None] | None = None,
    seo_card_by_item_id: dict[int, int | None] | None = None,
    repair_order_links: dict[int, dict] | None = None,
) -> list[PurchasedNewOrderItemResponse]:
    rossko_by_key = _rossko_lines_by_key(snapshot)
    merged: list[PurchasedNewOrderItemResponse] = []
    for item in order.items:
        line = rossko_by_key.get(item_match_key(item.brand, item.partnumber))
        status_code = _display_status_from_rossko_line(item.status_code, line)
        link = (repair_order_links or {}).get(item.id) or {}
        if seo_card_by_item_id is not None:
            seo_card_id = seo_card_by_item_id.get(int(item.id))
        elif resolve_seo_card_id is not None:
            seo_card_id = resolve_seo_card_id(db, item)
        else:
            stored = getattr(item, "seo_card_id", None)
            seo_card_id = int(stored) if stored else None
        merged.append(
            PurchasedNewOrderItemResponse(
                id=item.id,
                name=item.name,
                brand=item.brand,
                partnumber=item.partnumber,
                quantity=int(item.quantity),
                price=float(item.price),
                status_code=status_code,
                seo_card_id=seo_card_id,
                repair_order_id=link.get("id"),
                repair_order_number=link.get("order_number"),
            )
        )
    return merged


def build_seller_new_parts_order_response(
    db: Session,
    order: GarageNewOrder,
    *,
    rossko_by_id: dict[str, RosskoOrderSnapshot] | None = None,
    rossko_sync_error: str | None = None,
    buyer_avatar_url: str | None = None,
    buyer_user_id: int | None = None,
    resolve_seo_card_id: Callable[[Session, GarageNewOrderItem], int | None],
) -> NewPartsOrderResponse:
    base = NewPartsOrderResponse.model_validate(order)
    rossko_id = order.rossko_order_id
    snapshot = (rossko_by_id or {}).get(str(rossko_id)) if rossko_id else None
    items = merge_seller_items_with_rossko(db, order, snapshot, resolve_seo_card_id=resolve_seo_card_id)
    sync_error = per_order_sync_error(snapshot, rossko_sync_error) if rossko_id else None

    status_code = order.status_code
    if order.status_code in (NEW_PICKUP_READY_STATUS, "new_received"):
        status_code = order.status_code
    elif snapshot and not rossko_sync_error:
        status_code = aggregate_status_from_codes(
            [item.status_code for item in items],
            default=order.status_code or "new_waiting_confirmation",
        )

    update: dict = {
        "items": items,
        "status_code": status_code,
        "buyer_avatar_url": buyer_avatar_url,
        "buyer_user_id": buyer_user_id,
    }
    if rossko_id:
        update.update(
            {
                "rossko_order_id": rossko_id,
                "rossko_status": format_rossko_status(snapshot.status) if snapshot else None,
                "rossko_sync_error": sync_error,
            }
        )
    return base.model_copy(update=update)


def build_buyer_new_parts_order_response(
    db: Session,
    order: GarageNewOrder,
    *,
    rossko_by_id: dict[str, RosskoOrderSnapshot] | None = None,
    rossko_sync_error: str | None = None,
    organization_name: str | None = None,
    seller_user_id: int | None = None,
    resolve_seo_card_id: Callable[[Session, GarageNewOrderItem], int | None] | None = None,
    seo_card_by_item_id: dict[int, int | None] | None = None,
    repair_order_links: dict[int, dict] | None = None,
) -> PurchasedNewOrderResponse:
    rossko_id = order.rossko_order_id
    snapshot = (rossko_by_id or {}).get(str(rossko_id)) if rossko_id else None
    items = merge_buyer_items_with_rossko(
        db,
        order,
        snapshot,
        resolve_seo_card_id=resolve_seo_card_id,
        seo_card_by_item_id=seo_card_by_item_id,
        repair_order_links=repair_order_links,
    )

    status_code = order.status_code
    if order.status_code in (NEW_PICKUP_READY_STATUS, "new_received"):
        status_code = order.status_code
    elif snapshot and not rossko_sync_error:
        status_code = aggregate_status_from_codes(
            [item.status_code for item in items],
            default=order.status_code or "new_waiting_confirmation",
        )

    pickup = get_buyer_pickup_payload(order, order_kind="new")

    return PurchasedNewOrderResponse(
        id=order.id,
        organization_id=order.organization_id,
        organization_name=organization_name,
        seller_user_id=seller_user_id,
        buyer_name=order.buyer_name,
        buyer_phone=order.buyer_phone,
        buyer_email=order.buyer_email,
        delivery_type=order.delivery_type,
        delivery_address=order.delivery_address,
        transport_company=order.transport_company,
        pickup_address=order.pickup_address,
        delivery_region_id=order.delivery_region_id,
        delivery_region_name=order.delivery_region_name,
        total_amount=float(order.total_amount or 0),
        is_paid=bool(order.is_paid),
        status_code=status_code,
        seller=order.seller,
        deliver_in_parts=bool(order.deliver_in_parts),
        created_at=order.created_at,
        pickup_code=pickup["pickup_code"],
        pickup_qr_payload=pickup["pickup_qr_payload"],
        items=items,
    )
