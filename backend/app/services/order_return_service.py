"""Business logic for used-parts order return requests."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.models.garage_used_orders import GarageUsedOrder, GarageUsedOrderItem
from app.models.order_return import OrderReturnAttachment, OrderReturnRequest
from app.models.organization import Organization
from app.models.user import User
from app.schemas.order_returns import MAX_RETURN_ATTACHMENTS, OrderReturnCreate, OrderReturnStatusUpdate
from app.utils.client_buyers import order_visible_to_buyer

RETURN_WINDOW_DAYS = 14
ELIGIBLE_ORDER_STATUSES = frozenset({"delivered", "closed"})
TERMINAL_RETURN_STATUSES = frozenset({"rejected", "closed"})

RETURN_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    "requested": frozenset({"reviewing", "approved", "rejected"}),
    "reviewing": frozenset({"approved", "rejected"}),
    "approved": frozenset({"received"}),
    "received": frozenset({"refunded"}),
    "refunded": frozenset({"closed"}),
    "rejected": frozenset(),
    "closed": frozenset(),
}

RETURN_REASON_LABELS = {
    "defect": "Брак / неисправность",
    "wrong_item": "Не тот товар",
    "not_as_described": "Не соответствует описанию",
    "changed_mind": "Передумал",
    "other": "Другое",
}

RETURN_STATUS_LABELS = {
    "requested": "Заявка создана",
    "reviewing": "На рассмотрении",
    "approved": "Возврат согласован",
    "rejected": "Отклонён",
    "received": "Товар получен",
    "refunded": "Деньги возвращены",
    "closed": "Закрыто",
}


def return_status_label(status_code: str | None) -> str:
    if not status_code:
        return "Обновлён"
    return RETURN_STATUS_LABELS.get(status_code, status_code)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _order_eligible_for_return(order: GarageUsedOrder) -> None:
    if (order.status_code or "") not in ELIGIBLE_ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Возврат доступен только для завершённых заказов (получен / закрыт)",
        )

    ref_dt = order.updated_at or order.created_at
    if ref_dt is None:
        raise HTTPException(status_code=400, detail="Не удалось определить дату заказа")

    if ref_dt.tzinfo is None:
        ref_dt = ref_dt.replace(tzinfo=timezone.utc)
    deadline = ref_dt + timedelta(days=RETURN_WINDOW_DAYS)
    if _utcnow() > deadline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Срок возврата истёк ({RETURN_WINDOW_DAYS} дней после завершения заказа)",
        )

    has_site_product = any(getattr(item, "product_id", None) for item in (order.items or []))
    if not has_site_product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Возврат доступен только для заказов с товарами с сайта",
        )


def _get_active_return(db: Session, order_id: int) -> OrderReturnRequest | None:
    return (
        db.query(OrderReturnRequest)
        .filter(
            OrderReturnRequest.order_id == order_id,
            OrderReturnRequest.status_code.notin_(TERMINAL_RETURN_STATUSES),
        )
        .first()
    )


def _load_order_for_buyer(db: Session, order_id: int, user: User) -> GarageUsedOrder:
    order = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")

    target_email = user.email or ""
    target_phone = user.phone or ""
    if not order_visible_to_buyer(order, user.id, target_email, target_phone):
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")

    return order


def _load_order_for_seller(db: Session, order_id: int, user: User) -> GarageUsedOrder:
    order = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not user.is_admin and order.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    return order


def create_return_request(
    db: Session,
    user: User,
    payload: OrderReturnCreate,
) -> OrderReturnRequest:
    order = _load_order_for_buyer(db, payload.order_id, user)
    _order_eligible_for_return(order)

    if _get_active_return(db, order.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="По этому заказу уже есть активная заявка на возврат",
        )

    photo_urls = [u.strip() for u in (payload.photo_urls or []) if u and str(u).strip()]
    if len(photo_urls) > MAX_RETURN_ATTACHMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Максимум {MAX_RETURN_ATTACHMENTS} фото в заявке",
        )

    now = _utcnow()
    row = OrderReturnRequest(
        organization_id=order.organization_id,
        order_id=order.id,
        buyer_user_id=user.id,
        reason=payload.reason,
        comment=(payload.comment or "").strip() or None,
        status_code="requested",
        status_changed_at=now,
    )
    db.add(row)
    db.flush()

    for url in photo_urls:
        db.add(OrderReturnAttachment(return_request_id=row.id, file_url=url))

    db.commit()
    db.refresh(row)
    return row


def list_buyer_returns(db: Session, user: User) -> list[OrderReturnRequest]:
    target_email = user.email or ""
    target_phone = user.phone or ""

    orders = db.query(GarageUsedOrder).all()
    visible_order_ids = {
        o.id
        for o in orders
        if order_visible_to_buyer(o, user.id, target_email, target_phone)
    }
    if not visible_order_ids:
        return []

    return (
        db.query(OrderReturnRequest)
        .options(selectinload(OrderReturnRequest.attachments))
        .filter(OrderReturnRequest.order_id.in_(visible_order_ids))
        .order_by(OrderReturnRequest.created_at.desc())
        .all()
    )


def list_seller_returns(
    db: Session,
    user: User,
    *,
    status_filter: str | None = None,
) -> list[OrderReturnRequest]:
    if not user.organization_id and not user.is_admin:
        return []

    q = (
        db.query(OrderReturnRequest)
        .options(selectinload(OrderReturnRequest.attachments))
        .order_by(OrderReturnRequest.created_at.desc())
    )
    if not user.is_admin:
        q = q.filter(OrderReturnRequest.organization_id == user.organization_id)
    if status_filter:
        q = q.filter(OrderReturnRequest.status_code == status_filter)
    return q.all()


def get_return_for_buyer(db: Session, user: User, return_id: int) -> OrderReturnRequest:
    row = (
        db.query(OrderReturnRequest)
        .options(selectinload(OrderReturnRequest.attachments))
        .filter(OrderReturnRequest.id == return_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    _load_order_for_buyer(db, row.order_id, user)
    return row


def get_return_for_seller(db: Session, user: User, return_id: int) -> OrderReturnRequest:
    row = (
        db.query(OrderReturnRequest)
        .options(selectinload(OrderReturnRequest.attachments))
        .filter(OrderReturnRequest.id == return_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if not user.is_admin and row.organization_id != user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заявке")
    return row


def update_return_status(
    db: Session,
    user: User,
    return_id: int,
    payload: OrderReturnStatusUpdate,
) -> OrderReturnRequest:
    row = get_return_for_seller(db, user, return_id)
    new_status = payload.status_code
    current = row.status_code

    allowed = RETURN_STATUS_TRANSITIONS.get(current, frozenset())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя перевести заявку из «{return_status_label(current)}» в «{return_status_label(new_status)}»",
        )

    if new_status == "rejected":
        note = (payload.seller_note or "").strip()
        if not note:
            raise HTTPException(status_code=400, detail="Укажите причину отклонения в комментарии продавца")
        row.seller_note = note
    elif payload.seller_note:
        row.seller_note = payload.seller_note.strip()

    row.status_code = new_status
    row.status_changed_at = _utcnow()
    db.commit()
    db.refresh(row)
    return row


def add_return_attachment(
    db: Session,
    user: User,
    return_id: int,
    file_url: str,
) -> OrderReturnAttachment:
    row = get_return_for_buyer(db, user, return_id)
    if row.status_code in TERMINAL_RETURN_STATUSES:
        raise HTTPException(status_code=400, detail="Нельзя добавить фото к закрытой заявке")

    count = len(row.attachments or [])
    if count >= MAX_RETURN_ATTACHMENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Максимум {MAX_RETURN_ATTACHMENTS} фото в заявке",
        )

    attachment = OrderReturnAttachment(return_request_id=row.id, file_url=file_url)
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def build_order_snapshot(db: Session, order_id: int) -> dict | None:
    order = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .filter(GarageUsedOrder.id == order_id)
        .first()
    )
    if not order:
        return None

    org = db.query(Organization).filter(Organization.id == order.organization_id).first()
    items = [
        {
            "id": item.id,
            "name": item.name or "",
            "quantity": int(item.quantity or 0),
            "price": float(item.price or 0),
            "product_id": item.product_id,
        }
        for item in (order.items or [])
    ]
    return {
        "id": order.id,
        "organization_name": org.name if org else "Не указана",
        "buyer_name": order.buyer_name or "",
        "buyer_phone": order.buyer_phone or "",
        "buyer_email": order.buyer_email or "",
        "total_amount": float(order.total_amount or 0),
        "status_code": order.status_code or "",
        "created_at": order.created_at,
        "items": items,
    }


def order_is_return_eligible(db: Session, order_id: int, user: User) -> bool:
    try:
        order = _load_order_for_buyer(db, order_id, user)
        _order_eligible_for_return(order)
        if _get_active_return(db, order.id):
            return False
        return True
    except HTTPException:
        return False
