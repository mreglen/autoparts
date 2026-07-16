from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional, TYPE_CHECKING

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.garage_new_orders import GarageNewOrder, GarageNewOrderItem
from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization import Organization
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.utils.org_access import org_has_admin_director
from app.services.notification_service import notify_order_status_buyer
from app.services.order_pickup_chat_service import maybe_send_order_ready_pickup_chat_message
from app.schemas.sales_orders import (
    AvitoOrderResponseV2,
    AvitoRetryWarehouseResponse,
    AvitoWarehouseFulfillmentInfo,
    FulfilledOrderItemOut,
    MarkUsedOrderPaidRequest,
    MarkUsedOrderPaidResponse,
    NewPartsOrderCanViewResponse,
    NewPartsOrderItemResponse,
    NewPartsOrderResponse,
    PickupActionResponse,
    PickupOverrideRequest,
    UpdateStatusRequest,
    UpdateUsedOrderStatusResponse,
    UsedPartsOrderResponse,
    VerifyPickupRequest,
    PurchasedUsedOrderResponse,
    PurchasedNewOrderResponse,
    PurchasedNewOrderItemResponse,
)
from app.services.new_parts_order_enrichment import (
    build_buyer_new_parts_order_response,
    build_seller_new_parts_order_response,
    fetch_rossko_snapshots_for_orders,
)
if TYPE_CHECKING:
    from app.services.rossko_get_orders_service import RosskoOrderSnapshot
from app.services.rossko_status_labels import (
    NEW_PARTS_STATUS_CODES,
    NEW_PARTS_STATUS_PRIORITY,
)
from app.services.avito_warehouse_fulfillment import (
    compute_warehouse_fulfillment,
    enrich_avito_orders_response,
)
from app.services.marketplace_used_fulfillment import (
    FULFILLMENT_TRIGGER_STATUS,
    fulfill_used_order_on_status_change,
    fulfill_used_order_item_on_status_change,
)
from app.services.pickup_verification_service import (
    NEW_PICKUP_READY_STATUS,
    PICKUP_READY_STATUS,
    apply_pickup_override,
    block_direct_pickup_delivery,
    ensure_pickup_code,
    get_buyer_pickup_payload,
    is_pickup_delivery,
    verify_pickup_code,
)
from app.services.audit_service import log_audit
from app.utils.client_buyers import order_matches_buyer, order_visible_to_buyer
from app.utils.user_avatar import avatar_public_url, resolve_user_by_contact
from app.schemas.avito_orders import AvitoCheckConfirmationCodeRequest, AvitoOrderTransitionRequest
from app.schemas.sales_menu_counts import SalesMenuCountsResponse
from app.services.avito_pro_status_service import ensure_avito_pro_active
from app.services.sales_menu_counts_service import (
    get_sales_menu_badge_counts,
    user_has_sales_menu_access,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sales", tags=["Sales"])

ALLOWED_AVITO_TRANSITIONS = {
    "confirm", "reject", "perform", "receive",
    "in_transit_return", "on_delivery_return", "returned",
}

USED_ORDER_STATUS_CODES = frozenset({
    "pending",
    "confirmed",
    "rejected",
    "assembled",
    "ready_for_pickup",
    "shipped",
    "delivered",
    "closed",
})

USED_STATUS_PRIORITY: dict[str, int] = {
    "rejected": 0,
    "pending": 1,
    "confirmed": 2,
    "assembled": 3,
    "ready_for_pickup": 4,
    "shipped": 5,
    "delivered": 6,
    "closed": 7,
}


def _aggregate_order_status_from_items(
    items: list,
    *,
    priority: dict[str, int],
    default: str,
) -> str:
    codes = [str(getattr(i, "status_code", "") or "") for i in items]
    codes = [c for c in codes if c]
    if not codes:
        return default
    return min(codes, key=lambda c: priority.get(c, 999))


def _extract_avito_delivery_type(avito_data: dict[str, Any]) -> str:
    delivery = avito_data.get("delivery") or {}
    return str(delivery.get("type") or delivery.get("serviceType") or "").strip().lower()


def _extract_avito_marketplace_id(avito_data: dict[str, Any]) -> str | None:
    marketplace_id = avito_data.get("marketplaceId")
    if marketplace_id is None:
        return None
    marketplace_id_str = str(marketplace_id).strip()
    return marketplace_id_str or None


def _map_avito_error_to_http(exc: Exception) -> HTTPException:
    status_code = getattr(exc, "status_code", None)
    response_body = getattr(exc, "response_body", None)
    detail = str(exc)
    if status_code in (400, 401, 403, 404, 409, 422):
        return HTTPException(status_code=status_code, detail=detail if not response_body else f"{detail}: {response_body}")
    return HTTPException(status_code=502, detail=f"Ошибка вызова API Авито: {detail}")


def _has_sales_orders_access(db: Session, user: UserModel) -> bool:
    if user.is_admin or user.is_seller:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == "sales.orders")
    )
    return db.query(q.exists()).scalar() is True


def _require_sales_orders_access(db: Session, user: UserModel) -> None:
    if not _has_sales_orders_access(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к заказам")


@router.get("/menu-counts", response_model=SalesMenuCountsResponse)
def get_sales_menu_counts(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    if not user_has_sales_menu_access(db, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к разделу «Продажи»",
        )
    return SalesMenuCountsResponse(**get_sales_menu_badge_counts(db, current_user))


def _require_avito_pro_orders(db: Session, user: UserModel) -> None:
    if not user.organization_id:
        if user.is_admin:
            return
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="У пользователя нет organization_id")
    ensure_avito_pro_active(db, user.organization_id)


def _org_has_admin_director(db: Session, org_id: Optional[str]) -> bool:
    return org_has_admin_director(db, org_id)


def _buyer_avatar_for_order(db: Session, order) -> str | None:
    buyer = resolve_user_by_contact(db, order.buyer_phone, order.buyer_email)
    if not buyer:
        return None
    return avatar_public_url(buyer.avatar_url)


def _buyer_user_id_for_order(db: Session, order) -> int | None:
    user_id = getattr(order, "user_id", None)
    if user_id:
        return int(user_id)
    buyer = resolve_user_by_contact(db, order.buyer_phone, order.buyer_email)
    return buyer.id if buyer else None


def _seller_user_id_for_org(db: Session, org_id: str | None) -> int | None:
    if not org_id:
        return None
    seller = (
        db.query(UserModel)
        .filter(
            UserModel.organization_id == org_id,
            (UserModel.is_director == True) | (UserModel.is_seller == True),
        )
        .first()
    )
    if not seller:
        seller = db.query(UserModel).filter(UserModel.organization_id == org_id).first()
    return seller.id if seller else None


def _used_order_response(db: Session, order: GarageUsedOrder) -> UsedPartsOrderResponse:
    base = UsedPartsOrderResponse.model_validate(order)
    return base.model_copy(
        update={
            "buyer_avatar_url": _buyer_avatar_for_order(db, order),
            "buyer_user_id": _buyer_user_id_for_order(db, order),
        }
    )


def _can_view_new_parts_orders(db: Session, user: UserModel) -> bool:
    if user.is_admin:
        return True
    return _org_has_admin_director(db, user.organization_id)


def _resolve_new_part_seo_card_id(db: Session, item: GarageNewOrderItem) -> int | None:
    stored = getattr(item, "seo_card_id", None)
    if stored:
        return int(stored)
    from app.services.new_parts_seo_card_service import find_active_new_part_card_by_brand_article

    card = find_active_new_part_card_by_brand_article(db, item.brand, item.partnumber)
    return int(card.id) if card else None


def _new_order_response(
    db: Session,
    order: GarageNewOrder,
    *,
    rossko_by_id: dict[str, RosskoOrderSnapshot] | None = None,
    rossko_sync_error: str | None = None,
) -> NewPartsOrderResponse:
    return build_seller_new_parts_order_response(
        db,
        order,
        rossko_by_id=rossko_by_id,
        rossko_sync_error=rossko_sync_error,
        buyer_avatar_url=_buyer_avatar_for_order(db, order),
        buyer_user_id=_buyer_user_id_for_order(db, order),
        resolve_seo_card_id=_resolve_new_part_seo_card_id,
    )


@router.get("/used-parts-orders", response_model=list[UsedPartsOrderResponse])
def list_used_parts_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if not current_user.organization_id and not current_user.is_admin:
        return []

    q = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .order_by(GarageUsedOrder.created_at.desc())
    )
    if not current_user.is_admin:
        q = q.filter(GarageUsedOrder.organization_id == current_user.organization_id)
    orders = q.all()
    return [_used_order_response(db, o) for o in orders]


@router.put("/used-parts-orders/{order_id}/status", response_model=UpdateUsedOrderStatusResponse)
def update_used_parts_order_status(
    order_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if payload.status_code not in USED_ORDER_STATUS_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Недопустимый статус: {payload.status_code}",
        )
    order = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    block_direct_pickup_delivery(order, new_status=payload.status_code, order_kind="used")

    previous_status_code = order.status_code
    pickup_code: str | None = None
    try:
        summaries = fulfill_used_order_on_status_change(
            db,
            order=order,
            new_status_code=payload.status_code,
            previous_status_code=previous_status_code,
            acting_user_id=current_user.id,
        )
        if payload.status_code == PICKUP_READY_STATUS:
            if not is_pickup_delivery(order):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Статус «К выдаче» доступен только для самовывоза",
                )
            pickup_code = ensure_pickup_code(order, order_kind="used")
        order.status_code = payload.status_code
        for item in order.items:
            item.status_code = payload.status_code
        db.commit()
        log_audit(
            db,
            event_type="order_status_changed",
            category="orders",
            summary=f"Заказ Б/У #{order_id}: {previous_status_code} → {payload.status_code}",
            user=current_user,
            organization_id=order.organization_id,
            details={
                "order_id": order_id,
                "previous_status": previous_status_code,
                "new_status": payload.status_code,
                "fulfilled_count": len(summaries),
            },
            entity_type="garage_used_order",
            entity_id=order_id,
        )
        if summaries:
            log_audit(
                db,
                event_type="order_fulfilled",
                category="orders",
                summary=f"Проведено на склад: заказ #{order_id}, {len(summaries)} поз.",
                user=current_user,
                organization_id=order.organization_id,
                details={"order_id": order_id, "items": [
                    {"order_item_id": s.order_item_id, "stock_out_id": s.stock_out_id, "created": s.created}
                    for s in summaries
                ]},
                entity_type="garage_used_order",
                entity_id=order_id,
            )
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="used",
        status_code=payload.status_code,
        previous_status_code=previous_status_code,
        pickup_code=pickup_code,
    )
    maybe_send_order_ready_pickup_chat_message(
        db,
        buyer_user_id=order.user_id,
        seller_user_id=current_user.id,
        order_id=order_id,
        order_kind="used",
        pickup_code=pickup_code,
        previous_status_code=previous_status_code,
        new_status_code=payload.status_code,
    )

    return UpdateUsedOrderStatusResponse(
        status="ok",
        fulfilled_items=[
            FulfilledOrderItemOut(
                order_item_id=s.order_item_id,
                stock_out_id=s.stock_out_id,
                created=s.created,
            )
            for s in summaries
        ],
    )


@router.get("/new-parts-orders/can-view", response_model=NewPartsOrderCanViewResponse)
def new_parts_orders_can_view(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    return NewPartsOrderCanViewResponse(can_view=_can_view_new_parts_orders(db, current_user))


@router.get("/new-parts-orders", response_model=list[NewPartsOrderResponse])
def list_new_parts_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    org_id = current_user.organization_id
    if not _can_view_new_parts_orders(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")
    if not org_id and not current_user.is_admin:
        return []

    q = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .order_by(GarageNewOrder.created_at.desc())
    )
    if not current_user.is_admin:
        q = q.filter(GarageNewOrder.organization_id == org_id)
    orders = q.all()

    rossko_by_id, rossko_sync_error = fetch_rossko_snapshots_for_orders(orders)

    return [
        _new_order_response(db, o, rossko_by_id=rossko_by_id, rossko_sync_error=rossko_sync_error)
        for o in orders
    ]


@router.post("/new-parts-orders/{order_id}/refresh-supplier-status", response_model=NewPartsOrderResponse)
def refresh_new_parts_supplier_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Повторно запросить статус у поставщика (Rossko GetOrders) для одного заказа."""
    _require_sales_orders_access(db, current_user)
    org_id = current_user.organization_id
    if not _can_view_new_parts_orders(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")

    order = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    rossko_by_id, rossko_sync_error = fetch_rossko_snapshots_for_orders([order])
    return _new_order_response(db, order, rossko_by_id=rossko_by_id, rossko_sync_error=rossko_sync_error)


@router.put("/new-parts-orders/{order_id}/status")
def update_new_parts_order_status(
    order_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    org_id = current_user.organization_id
    if not _can_view_new_parts_orders(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")

    order = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    if payload.status_code not in NEW_PARTS_STATUS_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Недопустимый статус: {payload.status_code}",
        )
    block_direct_pickup_delivery(order, new_status=payload.status_code, order_kind="new")
    previous_status_code = order.status_code
    pickup_code: str | None = None
    if payload.status_code == NEW_PICKUP_READY_STATUS:
        if not is_pickup_delivery(order):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Статус «К выдаче» доступен только для самовывоза",
            )
        pickup_code = ensure_pickup_code(order, order_kind="new")
    order.status_code = payload.status_code
    for item in order.items:
        item.status_code = payload.status_code
    db.commit()
    log_audit(
        db,
        event_type="order_status_changed",
        category="orders",
        summary=f"Заказ новых запчастей #{order_id}: {previous_status_code} → {payload.status_code} (весь заказ)",
        user=current_user,
        organization_id=order.organization_id,
        details={
            "order_id": order_id,
            "previous_status": previous_status_code,
            "new_status": payload.status_code,
        },
        entity_type="garage_new_order",
        entity_id=order_id,
    )
    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="new",
        status_code=payload.status_code,
        previous_status_code=previous_status_code,
        pickup_code=pickup_code,
    )
    maybe_send_order_ready_pickup_chat_message(
        db,
        buyer_user_id=order.user_id,
        seller_user_id=current_user.id,
        order_id=order_id,
        order_kind="new",
        pickup_code=pickup_code,
        previous_status_code=previous_status_code,
        new_status_code=payload.status_code,
    )
    return {"status": "ok"}


@router.put("/new-parts-orders/{order_id}/items/{item_id}/status")
def update_new_parts_order_item_status(
    order_id: int,
    item_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    org_id = current_user.organization_id
    if not _can_view_new_parts_orders(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")

    if payload.status_code not in NEW_PARTS_STATUS_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Недопустимый статус: {payload.status_code}",
        )

    order = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    item = next((i for i in order.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Позиция заказа не найдена")

    if is_pickup_delivery(order) and payload.status_code in (
        NEW_PICKUP_READY_STATUS,
        "new_received",
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Для самовывоза выдачу оформляйте на уровне всего заказа",
        )

    previous_status_code = item.status_code
    previous_order_status = order.status_code
    item.status_code = payload.status_code
    order.status_code = _aggregate_order_status_from_items(
        order.items,
        priority=NEW_PARTS_STATUS_PRIORITY,
        default="new_waiting_confirmation",
    )
    db.commit()
    log_audit(
        db,
        event_type="order_item_status_changed",
        category="orders",
        summary=f"Позиция #{item_id} заказа новых #{order_id}: {previous_status_code} → {payload.status_code}",
        user=current_user,
        organization_id=order.organization_id,
        details={
            "order_id": order_id,
            "order_item_id": item_id,
            "previous_status": previous_status_code,
            "new_status": payload.status_code,
        },
        entity_type="garage_new_order_item",
        entity_id=item_id,
    )
    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="new",
        status_code=order.status_code,
        previous_status_code=previous_order_status,
    )
    return {"status": "ok", "order_status_code": order.status_code}


@router.put("/used-parts-orders/{order_id}/items/{item_id}/status", response_model=UpdateUsedOrderStatusResponse)
def update_used_parts_order_item_status(
    order_id: int,
    item_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if payload.status_code not in USED_ORDER_STATUS_CODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Недопустимый статус: {payload.status_code}",
        )

    order = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    item = next((i for i in order.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Позиция заказа не найдена")

    if is_pickup_delivery(order) and payload.status_code in (
        PICKUP_READY_STATUS,
        "delivered",
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Для самовывоза выдачу оформляйте на уровне всего заказа",
        )

    previous_item_status = item.status_code
    previous_order_status = order.status_code
    try:
        summary = fulfill_used_order_item_on_status_change(
            db,
            order=order,
            item=item,
            new_status_code=payload.status_code,
            previous_status_code=previous_item_status,
            acting_user_id=current_user.id,
        )
        if payload.status_code != FULFILLMENT_TRIGGER_STATUS or summary is None:
            item.status_code = payload.status_code

        order.status_code = _aggregate_order_status_from_items(
            order.items,
            priority=USED_STATUS_PRIORITY,
            default="pending",
        )
        db.commit()

        fulfilled_out = []
        if summary:
            fulfilled_out.append(
                FulfilledOrderItemOut(
                    order_item_id=summary.order_item_id,
                    stock_out_id=summary.stock_out_id,
                    created=summary.created,
                )
            )

        log_audit(
            db,
            event_type="order_item_status_changed",
            category="orders",
            summary=f"Позиция #{item_id} заказа Б/У #{order_id}: {previous_item_status} → {payload.status_code}",
            user=current_user,
            organization_id=order.organization_id,
            details={
                "order_id": order_id,
                "order_item_id": item_id,
                "previous_status": previous_item_status,
                "new_status": payload.status_code,
            },
            entity_type="garage_used_order_item",
            entity_id=item_id,
        )

        notify_order_status_buyer(
            user_id=order.user_id,
            order_id=order_id,
            order_kind="used",
            status_code=order.status_code,
            previous_status_code=previous_order_status,
        )

        return UpdateUsedOrderStatusResponse(status="ok", fulfilled_items=fulfilled_out)
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise


@router.get("/avito-orders", response_model=list[AvitoOrderResponseV2])
def list_avito_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    _require_avito_pro_orders(db, current_user)
    if not current_user.organization_id and not current_user.is_admin:
        return []
    q = db.query(AvitoOrderCache).order_by(AvitoOrderCache.created_at.desc())
    if not current_user.is_admin:
        q = q.filter(AvitoOrderCache.organization_id == current_user.organization_id)
    orders = q.all()
    return enrich_avito_orders_response(db, orders)


@router.post("/avito-orders/sync")
async def sync_avito_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    _require_avito_pro_orders(db, current_user)
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="У пользователя нет organization_id")

    from app.services.avito_orders_sync import sync_avito_orders_for_org

    result = await sync_avito_orders_for_org(db, organization_id=current_user.organization_id)
    return result


@router.post("/avito-orders/{order_id}/retry-warehouse", response_model=AvitoRetryWarehouseResponse)
async def retry_avito_warehouse(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Повторная проводка склада для закрытого заказа Авито."""
    _require_sales_orders_access(db, current_user)
    _require_avito_pro_orders(db, current_user)

    order = db.query(AvitoOrderCache).filter(AvitoOrderCache.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ Авито не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    status_code = str(order.avito_status_code or "").strip().lower()
    if status_code != "closed":
        raise HTTPException(
            status_code=400,
            detail="Проводка склада доступна только для заказов со статусом closed",
        )

    wf_preview = compute_warehouse_fulfillment(db, order)
    if not wf_preview.get("can_retry"):
        raise HTTPException(
            status_code=400,
            detail="Склад по этому заказу уже проведён полностью",
        )

    integration = (
        db.query(OrganizationAvitoIntegration)
        .filter(OrganizationAvitoIntegration.organization_id == order.organization_id)
        .first()
    )
    if not integration or not integration.client_secret_encrypted or not integration.avito_user_id:
        raise HTTPException(status_code=400, detail="Интеграция с Авито не настроена")

    from app.services import avito_api as avito_api_svc
    from app.services.avito_closed_order_processor import process_closed_avito_order
    from app.utils.avito_crypto import decrypt_secret

    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        process_result = await process_closed_avito_order(
            db,
            order,
            access_token=token,
            avito_user_id=int(integration.avito_user_id),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error retrying Avito warehouse for order %s", order_id)
        raise HTTPException(status_code=500, detail=str(e))

    db.refresh(order)
    wf = compute_warehouse_fulfillment(db, order)
    log_audit(
        db,
        event_type="avito_warehouse_retry",
        category="sales",
        summary=f"Повтор проведения Авито: заказ #{order_id}",
        user=current_user,
        organization_id=order.organization_id,
        details={
            "order_id": order_id,
            "processed_count": int(process_result.get("processed_count", 0)),
            "created_count": int(process_result.get("created_count", 0)),
        },
        entity_type="avito_order",
        entity_id=order_id,
    )
    return AvitoRetryWarehouseResponse(
        processed_count=int(process_result.get("processed_count", 0)),
        reused_count=int(process_result.get("reused_count", 0)),
        created_count=int(process_result.get("created_count", 0)),
        skipped_count=int(process_result.get("skipped_count", 0)),
        warehouse_fulfillment=AvitoWarehouseFulfillmentInfo(**wf),
    )


@router.post("/avito-orders/{order_id}/transition")
async def apply_avito_order_transition(
    order_id: int,
    payload: AvitoOrderTransitionRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Apply status transition to Avito order via Avito API"""
    _require_sales_orders_access(db, current_user)
    _require_avito_pro_orders(db, current_user)
    
    order = db.query(AvitoOrderCache).filter(AvitoOrderCache.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ Авито не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    
    # Get Avito integration for the organization
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == order.organization_id
    ).first()
    if not integration or not integration.client_secret_encrypted:
        raise HTTPException(status_code=400, detail="Интеграция с Авито не настроена")
    
    # Get access token and apply transition
    from app.services import avito_api as avito_api_svc
    from app.utils.avito_crypto import decrypt_secret
    from app.services.avito_orders_api import apply_order_transition, check_confirmation_code, get_available_transitions
    
    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        # Получаем токен с scope для Order Management API
        token = await avito_api_svc.fetch_access_token(
            integration.client_id, 
            secret,
            scope="order-management"
        )
        
        transition = str(payload.transition or "").strip().lower()
        if transition not in ALLOWED_AVITO_TRANSITIONS:
            raise HTTPException(status_code=422, detail=f"Недопустимый transition: {transition}")

        transition_params = payload.params or {}
        if not isinstance(transition_params, dict):
            raise HTTPException(status_code=422, detail="params должен быть объектом")

        avito_data = order.avito_data or {}
        delivery_type = _extract_avito_delivery_type(avito_data)

        available_transitions = await get_available_transitions(
            token,
            order_id=int(order.avito_order_id),
            order_status=order.avito_status_code or "",
            delivery_type=delivery_type,
        )
        if transition not in available_transitions:
            raise HTTPException(
                status_code=409,
                detail=f"Переход '{transition}' сейчас недоступен. Доступно: {available_transitions}",
            )

        if delivery_type == "cnc" and transition == "receive":
            cnc_params = transition_params.get("cnc") if isinstance(transition_params.get("cnc"), dict) else {}
            marketplace_id = cnc_params.get("marketplaceId") or _extract_avito_marketplace_id(avito_data)
            if not marketplace_id:
                raise HTTPException(status_code=422, detail="Для CNC receive требуется marketplaceId")
            confirm_code = cnc_params.get("confirmCode")
            if not confirm_code:
                raise HTTPException(status_code=422, detail="Для CNC receive требуется confirmCode")
            transition_params["cnc"] = {"marketplaceId": str(marketplace_id)}
            transition_params["cnc"]["confirmCode"] = str(confirm_code)
            await check_confirmation_code(
                token,
                order_id=int(order.avito_order_id),
                confirm_code=str(confirm_code),
                marketplace_id=str(marketplace_id),
            )
        
        result = await apply_order_transition(
            token,
            int(order.avito_order_id),
            transition,
            transition_params if transition_params else None
        )
        
        # Update status in database based on transition
        status_map = {
            'confirm': 'ready_to_ship',
            'reject': 'canceled',
            'perform': 'in_transit',
            'receive': 'delivered',
        }
        order.avito_status_code = status_map.get(transition, order.avito_status_code)
        db.commit()
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error applying Avito transition for order {order_id}")
        raise _map_avito_error_to_http(e)


@router.get("/avito-orders/{order_id}/transitions")
async def get_avito_order_transitions(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Get available transitions for an Avito order"""
    _require_sales_orders_access(db, current_user)
    _require_avito_pro_orders(db, current_user)
    
    order = db.query(AvitoOrderCache).filter(AvitoOrderCache.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ Авито не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    
    # Get Avito integration for the organization
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == order.organization_id
    ).first()
    if not integration or not integration.client_secret_encrypted:
        raise HTTPException(status_code=400, detail="Интеграция с Авито не настроена")
    
    # Get access token and fetch transitions
    from app.services import avito_api as avito_api_svc
    from app.utils.avito_crypto import decrypt_secret
    from app.services.avito_orders_api import get_available_transitions
    
    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        # Получаем токен с scope для Order Management API
        token = await avito_api_svc.fetch_access_token(
            integration.client_id, 
            secret,
            scope="order-management"
        )
        
        transitions = await get_available_transitions(
            token,
            order_id=int(order.avito_order_id),
            order_status=order.avito_status_code or "",
            delivery_type=_extract_avito_delivery_type(order.avito_data or {}),
        )
        
        return {"transitions": transitions}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching Avito transitions for order {order_id}")
        raise _map_avito_error_to_http(e)


@router.post("/avito-orders/{order_id}/check-confirmation-code")
async def check_avito_confirmation_code(
    order_id: int,
    payload: AvitoCheckConfirmationCodeRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Проверить confirmation code для CNC заказа через Avito API."""
    _require_sales_orders_access(db, current_user)
    _require_avito_pro_orders(db, current_user)

    order = db.query(AvitoOrderCache).filter(AvitoOrderCache.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ Авито не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == order.organization_id
    ).first()
    if not integration or not integration.client_secret_encrypted:
        raise HTTPException(status_code=400, detail="Интеграция с Авито не настроена")

    avito_data = order.avito_data or {}
    delivery_type = _extract_avito_delivery_type(avito_data)
    if delivery_type != "cnc":
        raise HTTPException(status_code=422, detail="Проверка кода применима только к CNC заказам")

    marketplace_id = payload.marketplace_id or _extract_avito_marketplace_id(avito_data)
    if not marketplace_id:
        raise HTTPException(status_code=422, detail="Не удалось определить marketplaceId для заказа")

    from app.services import avito_api as avito_api_svc
    from app.utils.avito_crypto import decrypt_secret
    from app.services.avito_orders_api import check_confirmation_code

    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        # Получаем токен с scope для Order Management API
        token = await avito_api_svc.fetch_access_token(
            integration.client_id, 
            secret,
            scope="order-management"
        )
        result = await check_confirmation_code(
            token,
            order_id=int(order.avito_order_id),
            confirm_code=payload.confirm_code,
            marketplace_id=str(marketplace_id),
        )
        return {"status": "ok", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error checking confirmation code for Avito order %s", order_id)
        raise _map_avito_error_to_http(e)


def _load_used_order_for_seller(db: Session, order_id: int, current_user: UserModel) -> GarageUsedOrder:
    order = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    return order


def _load_new_order_for_seller(db: Session, order_id: int, current_user: UserModel) -> GarageNewOrder:
    order = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    return order


@router.post(
    "/used-parts-orders/{order_id}/mark-paid",
    response_model=MarkUsedOrderPaidResponse,
)
def mark_used_order_paid(
    order_id: int,
    payload: MarkUsedOrderPaidRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Подтвердить оплату б/у заказа выбранным способом оплаты организации."""
    from app.models.payment_method import PaymentMethod, organization_payment_methods
    from app.models.stock_out import StockOut

    _require_sales_orders_access(db, current_user)
    order = _load_used_order_for_seller(db, order_id, current_user)

    if order.is_paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Заказ уже оплачен",
        )

    method = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.id == payload.payment_method_id)
        .first()
    )
    if not method:
        raise HTTPException(status_code=404, detail="Способ оплаты не найден")

    assigned = db.execute(
        organization_payment_methods.select().where(
            organization_payment_methods.c.organization_id == order.organization_id,
            organization_payment_methods.c.payment_method_id == method.id,
        )
    ).fetchone()
    if not assigned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Способ оплаты не назначен организации",
        )

    paid_at = datetime.now(timezone.utc)
    order.is_paid = True
    order.payment_method_id = method.id
    order.payment_method_name = method.name
    order.paid_at = paid_at

    item_ids = [item.id for item in (order.items or []) if item.id]
    if item_ids:
        stock_outs = (
            db.query(StockOut)
            .filter(StockOut.garage_used_order_item_id.in_(item_ids))
            .all()
        )
        for so in stock_outs:
            so.payment_method = method.name

    db.commit()
    db.refresh(order)

    log_audit(
        db,
        event_type="order_marked_paid",
        category="orders",
        summary=f"Заказ Б/У #{order_id} оплачен ({method.name})",
        user=current_user,
        organization_id=order.organization_id,
        details={
            "order_id": order_id,
            "payment_method_id": method.id,
            "payment_method_name": method.name,
            "total_amount": order.total_amount,
        },
        entity_type="garage_used_order",
        entity_id=order_id,
    )

    return MarkUsedOrderPaidResponse(
        is_paid=True,
        payment_method_id=method.id,
        payment_method_name=method.name,
        paid_at=paid_at,
    )


@router.post(
    "/used-parts-orders/{order_id}/verify-pickup",
    response_model=PickupActionResponse,
)
def verify_used_pickup(
    order_id: int,
    payload: VerifyPickupRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    order = _load_used_order_for_seller(db, order_id, current_user)
    if not is_pickup_delivery(order):
        raise HTTPException(status_code=422, detail="Проверка кода только для самовывоза")
    previous = order.status_code
    try:
        delivered = verify_pickup_code(
            order,
            code=payload.code,
            qr_payload=payload.qr_payload,
            order_kind="used",
        )
        order.status_code = delivered
        for item in order.items:
            item.status_code = delivered
        db.commit()
    except HTTPException:
        db.commit()  # persist attempts
        raise
    log_audit(
        db,
        event_type="order_pickup_verified",
        category="orders",
        summary=f"Выдача Б/У #{order_id} по коду",
        user=current_user,
        organization_id=order.organization_id,
        details={"order_id": order_id, "previous_status": previous, "new_status": delivered},
        entity_type="garage_used_order",
        entity_id=order_id,
    )
    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="used",
        status_code=delivered,
        previous_status_code=previous,
    )
    return PickupActionResponse(status="ok", status_code=delivered, order_id=order_id)


@router.post(
    "/used-parts-orders/{order_id}/pickup-override",
    response_model=PickupActionResponse,
)
def override_used_pickup(
    order_id: int,
    payload: PickupOverrideRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    order = _load_used_order_for_seller(db, order_id, current_user)
    if not is_pickup_delivery(order):
        raise HTTPException(status_code=422, detail="Override только для самовывоза")
    previous = order.status_code
    delivered = apply_pickup_override(order, order_kind="used")
    order.status_code = delivered
    for item in order.items:
        item.status_code = delivered
    db.commit()
    log_audit(
        db,
        event_type="order_pickup_override",
        category="orders",
        summary=f"Выдача Б/У #{order_id} без кода",
        user=current_user,
        organization_id=order.organization_id,
        details={
            "order_id": order_id,
            "previous_status": previous,
            "new_status": delivered,
            "reason": payload.reason.strip(),
        },
        entity_type="garage_used_order",
        entity_id=order_id,
    )
    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="used",
        status_code=delivered,
        previous_status_code=previous,
    )
    return PickupActionResponse(status="ok", status_code=delivered, order_id=order_id)


@router.post(
    "/new-parts-orders/{order_id}/verify-pickup",
    response_model=PickupActionResponse,
)
def verify_new_pickup(
    order_id: int,
    payload: VerifyPickupRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if not _can_view_new_parts_orders(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")
    order = _load_new_order_for_seller(db, order_id, current_user)
    if not is_pickup_delivery(order):
        raise HTTPException(status_code=422, detail="Проверка кода только для самовывоза")
    previous = order.status_code
    try:
        delivered = verify_pickup_code(
            order,
            code=payload.code,
            qr_payload=payload.qr_payload,
            order_kind="new",
        )
        order.status_code = delivered
        for item in order.items:
            item.status_code = delivered
        db.commit()
    except HTTPException:
        db.commit()
        raise
    log_audit(
        db,
        event_type="order_pickup_verified",
        category="orders",
        summary=f"Выдача новых #{order_id} по коду",
        user=current_user,
        organization_id=order.organization_id,
        details={"order_id": order_id, "previous_status": previous, "new_status": delivered},
        entity_type="garage_new_order",
        entity_id=order_id,
    )
    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="new",
        status_code=delivered,
        previous_status_code=previous,
    )
    return PickupActionResponse(status="ok", status_code=delivered, order_id=order_id)


@router.post(
    "/new-parts-orders/{order_id}/pickup-override",
    response_model=PickupActionResponse,
)
def override_new_pickup(
    order_id: int,
    payload: PickupOverrideRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if not _can_view_new_parts_orders(db, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")
    order = _load_new_order_for_seller(db, order_id, current_user)
    if not is_pickup_delivery(order):
        raise HTTPException(status_code=422, detail="Override только для самовывоза")
    previous = order.status_code
    delivered = apply_pickup_override(order, order_kind="new")
    order.status_code = delivered
    for item in order.items:
        item.status_code = delivered
    db.commit()
    log_audit(
        db,
        event_type="order_pickup_override",
        category="orders",
        summary=f"Выдача новых #{order_id} без кода",
        user=current_user,
        organization_id=order.organization_id,
        details={
            "order_id": order_id,
            "previous_status": previous,
            "new_status": delivered,
            "reason": payload.reason.strip(),
        },
        entity_type="garage_new_order",
        entity_id=order_id,
    )
    notify_order_status_buyer(
        user_id=order.user_id,
        order_id=order_id,
        order_kind="new",
        status_code=delivered,
        previous_status_code=previous,
    )
    return PickupActionResponse(status="ok", status_code=delivered, order_id=order_id)


# Purchase endpoints for buyers
@router.get("/purchases/used-orders", response_model=list[PurchasedUsedOrderResponse])
def list_purchased_used_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Заказы б/у текущего покупателя (по user_id или email+телефону для legacy)."""
    target_email = current_user.email or ""
    target_phone = current_user.phone or ""

    orders = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .order_by(GarageUsedOrder.created_at.desc())
        .all()
    )

    result = []
    for order in orders:
        if not order_visible_to_buyer(order, current_user.id, target_email, target_phone):
            continue
        org = db.query(Organization).filter(Organization.id == order.organization_id).first()
        pickup = get_buyer_pickup_payload(order, order_kind="used")
        order_dict = {
            "id": order.id,
            "organization_id": order.organization_id,
            "organization_name": org.name if org else "Не указана",
            "seller_user_id": _seller_user_id_for_org(db, order.organization_id),
            "buyer_name": order.buyer_name,
            "buyer_phone": order.buyer_phone,
            "buyer_email": order.buyer_email,
            "buyer_comment": order.buyer_comment,
            "delivery_type": order.delivery_type,
            "delivery_address": order.delivery_address,
            "transport_company": order.transport_company,
            "pickup_address": order.pickup_address,
            "total_amount": order.total_amount,
            "is_paid": order.is_paid,
            "payment_method_id": getattr(order, "payment_method_id", None),
            "payment_method_name": getattr(order, "payment_method_name", None),
            "paid_at": getattr(order, "paid_at", None),
            "status_code": order.status_code,
            "created_at": order.created_at,
            "pickup_code": pickup["pickup_code"],
            "pickup_qr_payload": pickup["pickup_qr_payload"],
            "items": order.items,
        }
        result.append(order_dict)
    
    return result


@router.get("/purchases/new-orders", response_model=list[PurchasedNewOrderResponse])
def list_purchased_new_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Новые заказы текущего покупателя (по user_id)."""
    orders = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .filter(GarageNewOrder.user_id == current_user.id)
        .order_by(GarageNewOrder.created_at.desc())
        .all()
    )

    rossko_by_id, rossko_sync_error = fetch_rossko_snapshots_for_orders(orders)

    result = []
    for order in orders:
        org = db.query(Organization).filter(Organization.id == order.organization_id).first()
        result.append(
            build_buyer_new_parts_order_response(
                db,
                order,
                rossko_by_id=rossko_by_id,
                rossko_sync_error=rossko_sync_error,
                organization_name=org.name if org else None,
                seller_user_id=_seller_user_id_for_org(db, order.organization_id),
                resolve_seo_card_id=_resolve_new_part_seo_card_id,
            )
        )

    return result

