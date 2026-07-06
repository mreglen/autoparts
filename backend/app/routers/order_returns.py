"""Order return API endpoints under /sales prefix."""
from __future__ import annotations

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.schemas.order_returns import (
    AvitoAcceptReturnRequest,
    AvitoReturnOrderOut,
    OrderReturnCreate,
    OrderReturnOut,
    OrderReturnStatusUpdate,
)
from app.services.order_return_service import (
    RETURN_REASON_LABELS,
    add_return_attachment,
    build_order_snapshot,
    create_return_request,
    get_return_for_buyer,
    get_return_for_seller,
    list_buyer_returns,
    list_seller_returns,
    return_status_label,
    update_return_status,
)
from app.services.notification_service import (
    notify_return_request_seller,
    notify_return_status_buyer,
)

router = APIRouter(prefix="/sales", tags=["Order Returns"])

AVITO_RETURN_STATUSES = frozenset({
    "on_return",
    "in_dispute",
    "in_transit_return",
    "on_delivery_return",
})


def _has_sales_returns_access(db: Session, user: UserModel) -> bool:
    if user.is_admin or user.is_seller:
        return True
    if not user.is_employee:
        return False
    q = (
        db.query(Permission.code)
        .join(UserPermission, UserPermission.permission_id == Permission.id)
        .filter(UserPermission.user_id == user.id, Permission.code == "sales.returns")
    )
    return db.query(q.exists()).scalar() is True


def _require_sales_returns_access(db: Session, user: UserModel) -> None:
    if not _has_sales_returns_access(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к возвратам")


def _serialize_return_with_db(db: Session, row, *, include_order: bool = False) -> OrderReturnOut:
    order_snapshot = build_order_snapshot(db, row.order_id) if include_order else None
    return OrderReturnOut(
        id=row.id,
        organization_id=row.organization_id,
        order_id=row.order_id,
        buyer_user_id=row.buyer_user_id,
        reason=row.reason,
        comment=row.comment,
        status_code=row.status_code,
        seller_note=row.seller_note,
        created_at=row.created_at,
        updated_at=row.updated_at,
        status_changed_at=row.status_changed_at,
        attachments=row.attachments or [],
        order=order_snapshot,
    )


@router.post("/purchases/returns", response_model=OrderReturnOut, status_code=status.HTTP_201_CREATED)
def buyer_create_return(
    payload: OrderReturnCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    row = create_return_request(db, current_user, payload)
    reason_label = RETURN_REASON_LABELS.get(row.reason, row.reason)
    notify_return_request_seller(
        db,
        organization_id=row.organization_id,
        return_id=row.id,
        order_id=row.order_id,
        reason_label=reason_label,
    )
    return _serialize_return_with_db(db, row, include_order=True)


@router.get("/purchases/returns", response_model=list[OrderReturnOut])
def buyer_list_returns(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    rows = list_buyer_returns(db, current_user)
    return [_serialize_return_with_db(db, r, include_order=True) for r in rows]


@router.get("/purchases/returns/{return_id}", response_model=OrderReturnOut)
def buyer_get_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    row = get_return_for_buyer(db, current_user, return_id)
    return _serialize_return_with_db(db, row, include_order=True)


@router.post("/purchases/returns/{return_id}/attachments")
async def buyer_add_return_attachment(
    return_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Допустимы только изображения")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10 МБ)")

    org_id = current_user.organization_id or "common"
    rel_dir = os.path.join(os.path.abspath("uploads"), "returns", org_id)
    os.makedirs(rel_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(rel_dir, filename)
    with open(abs_path, "wb") as fh:
        fh.write(content)

    file_url = f"/uploads/returns/{org_id}/{filename}"
    attachment = add_return_attachment(db, current_user, return_id, file_url)
    return {"id": attachment.id, "file_url": attachment.file_url}


@router.get("/returns", response_model=list[OrderReturnOut])
def seller_list_returns(
    status_code: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_returns_access(db, current_user)
    rows = list_seller_returns(db, current_user, status_filter=status_code)
    return [_serialize_return_with_db(db, r, include_order=True) for r in rows]


@router.get("/returns/{return_id}", response_model=OrderReturnOut)
def seller_get_return(
    return_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_returns_access(db, current_user)
    row = get_return_for_seller(db, current_user, return_id)
    return _serialize_return_with_db(db, row, include_order=True)


@router.patch("/returns/{return_id}/status", response_model=OrderReturnOut)
def seller_update_return_status(
    return_id: int,
    payload: OrderReturnStatusUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_returns_access(db, current_user)
    row_before = get_return_for_seller(db, current_user, return_id)
    prev = row_before.status_code
    row = update_return_status(db, current_user, return_id, payload)
    notify_return_status_buyer(
        user_id=row.buyer_user_id,
        return_id=row.id,
        order_id=row.order_id,
        status_code=row.status_code,
        previous_status_code=prev,
    )
    return _serialize_return_with_db(db, row, include_order=True)


@router.get("/avito-orders/returns", response_model=list[AvitoReturnOrderOut])
def list_avito_return_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_returns_access(db, current_user)
    from app.routers.sales import _require_avito_pro_orders

    _require_avito_pro_orders(db, current_user)

    q = db.query(AvitoOrderCache).order_by(AvitoOrderCache.created_at.desc())
    if not current_user.is_admin:
        q = q.filter(AvitoOrderCache.organization_id == current_user.organization_id)
    q = q.filter(AvitoOrderCache.avito_status_code.in_(AVITO_RETURN_STATUSES))

    return [
        AvitoReturnOrderOut(
            id=o.id,
            avito_order_id=o.avito_order_id,
            avito_status_code=o.avito_status_code,
            total_amount=float(o.total_amount or 0),
            created_at=o.created_at,
            avito_data=o.avito_data,
        )
        for o in q.all()
    ]


@router.post("/avito-orders/{order_id}/accept-return")
async def avito_accept_return(
    order_id: int,
    payload: AvitoAcceptReturnRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_returns_access(db, current_user)
    from app.routers.sales import _map_avito_error_to_http, _require_avito_pro_orders
    from app.services import avito_api as avito_api_svc
    from app.services.avito_orders_api import accept_return_order
    from app.utils.avito_crypto import decrypt_secret

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

    terminal = (payload.terminal_number or "").strip()
    if not terminal:
        raise HTTPException(status_code=400, detail="Укажите номер отделения Почты России")

    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(
            integration.client_id,
            secret,
            scope="order-management",
        )
        recipient = None
        if payload.recipient_name or payload.recipient_phone:
            recipient = {}
            if payload.recipient_name:
                recipient["name"] = payload.recipient_name.strip()
            if payload.recipient_phone:
                recipient["phone"] = payload.recipient_phone.strip()

        result = await accept_return_order(
            token,
            order_id=int(order.avito_order_id),
            terminal_number=terminal,
            recipient=recipient,
        )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise _map_avito_error_to_http(exc)
