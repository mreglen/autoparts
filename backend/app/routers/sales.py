from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.garage_new_orders import GarageNewOrder
from app.models.garage_used_orders import GarageUsedOrder
from app.models.avito_orders_cache import AvitoOrderCache
from app.models.organization import Organization
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.permission import Permission
from app.models.user import User as UserModel
from app.models.user_permission import UserPermission
from app.schemas.sales_orders import (
    AvitoOrderResponseV2,
    NewPartsOrderResponse,
    UpdateStatusRequest,
    UsedPartsOrderResponse,
    PurchasedUsedOrderResponse,
    PurchasedNewOrderResponse,
)
from app.schemas.avito_orders import (
    AvitoCheckConfirmationCodeRequest,
    AvitoCncSetDetailsRequest,
    AvitoOrderTransitionRequest,
)

logger = logging.getLogger(__name__)
CONFIRM_CODE_RE = re.compile(r"^\d{4}$")

router = APIRouter(prefix="/sales", tags=["Sales"])

ALLOWED_AVITO_TRANSITIONS = {"confirm", "reject", "perform", "receive"}


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


def _org_has_admin_director(db: Session, org_id: Optional[str]) -> bool:
    if not org_id:
        return False
    q = db.query(UserModel.id).filter(
        UserModel.organization_id == org_id,
        UserModel.is_director == True,  # noqa: E712
        UserModel.is_admin == True,  # noqa: E712
    )
    return db.query(q.exists()).scalar() is True


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
    return q.all()


@router.put("/used-parts-orders/{order_id}/status")
def update_used_parts_order_status(
    order_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    order = db.query(GarageUsedOrder).filter(GarageUsedOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    order.status_code = payload.status_code
    db.commit()
    return {"status": "ok"}


@router.get("/new-parts-orders", response_model=list[NewPartsOrderResponse])
def list_new_parts_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    org_id = current_user.organization_id
    if not current_user.is_admin and not _org_has_admin_director(db, org_id):
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
    return q.all()


@router.put("/new-parts-orders/{order_id}/status")
def update_new_parts_order_status(
    order_id: int,
    payload: UpdateStatusRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    org_id = current_user.organization_id
    if not current_user.is_admin and not _org_has_admin_director(db, org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Новые заказы недоступны для организации")

    order = db.query(GarageNewOrder).filter(GarageNewOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if not current_user.is_admin and order.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Нет доступа к заказу")
    order.status_code = payload.status_code
    db.commit()
    return {"status": "ok"}


@router.get("/avito-orders", response_model=list[AvitoOrderResponseV2])
def list_avito_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if not current_user.organization_id and not current_user.is_admin:
        return []
    q = db.query(AvitoOrderCache).order_by(AvitoOrderCache.created_at.desc())
    if not current_user.is_admin:
        q = q.filter(AvitoOrderCache.organization_id == current_user.organization_id)
    return q.all()


@router.post("/avito-orders/sync")
async def sync_avito_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    _require_sales_orders_access(db, current_user)
    if not current_user.organization_id:
        raise HTTPException(status_code=400, detail="У пользователя нет organization_id")

    from app.services.avito_orders_sync import sync_avito_orders_for_org

    result = await sync_avito_orders_for_org(db, organization_id=current_user.organization_id)
    return result


@router.post("/avito-orders/{order_id}/transition")
async def apply_avito_order_transition(
    order_id: int,
    payload: AvitoOrderTransitionRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Apply status transition to Avito order via Avito API"""
    _require_sales_orders_access(db, current_user)
    
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
            confirm_code = str(confirm_code).strip()
            if not CONFIRM_CODE_RE.fullmatch(confirm_code):
                raise HTTPException(status_code=422, detail="Для CNC receive confirmCode должен состоять из 4 цифр")
            transition_params["cnc"] = {"marketplaceId": str(marketplace_id)}
            transition_params["cnc"]["confirmCode"] = confirm_code
            await check_confirmation_code(
                token,
                order_id=int(order.avito_order_id),
                confirm_code=confirm_code,
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
    confirm_code = str(payload.confirm_code or "").strip()
    if not CONFIRM_CODE_RE.fullmatch(confirm_code):
        raise HTTPException(status_code=422, detail="Код подтверждения должен состоять из 4 цифр")

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
            confirm_code=confirm_code,
            marketplace_id=str(marketplace_id),
        )
        return {"status": "ok", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error checking confirmation code for Avito order %s", order_id)
        raise _map_avito_error_to_http(e)


@router.post("/avito-orders/{order_id}/cnc-set-details")
async def set_avito_cnc_details(
    order_id: int,
    payload: AvitoCncSetDetailsRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Подготовить CNC-заказ перед переходом receive."""
    _require_sales_orders_access(db, current_user)

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
        raise HTTPException(status_code=422, detail="Подготовка заказа доступна только для CNC")

    marketplace_id = payload.marketplace_id or _extract_avito_marketplace_id(avito_data)
    if not marketplace_id:
        raise HTTPException(status_code=422, detail="Не удалось определить marketplaceId для заказа")

    from app.services import avito_api as avito_api_svc
    from app.utils.avito_crypto import decrypt_secret
    from app.services.avito_orders_api import cnc_set_details

    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(
            integration.client_id,
            secret,
            scope="order-management"
        )
        result = await cnc_set_details(
            token,
            order_id=int(order.avito_order_id),
            marketplace_id=str(marketplace_id),
            booking_period=int(payload.booking_period),
            address=payload.address,
            details=payload.details,
        )
        # Persist local hint that CNC order has been prepared in this system.
        avito_data_current = order.avito_data if isinstance(order.avito_data, dict) else {}
        order.avito_data = {
            **avito_data_current,
            "cncPrepared": {
                "prepared": True,
                "address": payload.address,
                "details": payload.details,
                "bookingPeriod": int(payload.booking_period),
                "marketplaceId": str(marketplace_id),
                "preparedAt": datetime.utcnow().isoformat(),
            },
        }
        db.commit()
        return {"status": "ok", "result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error setting CNC details for Avito order %s", order_id)
        raise _map_avito_error_to_http(e)


# Purchase endpoints for buyers
@router.get("/purchases/used-orders", response_model=list[PurchasedUsedOrderResponse])
def list_purchased_used_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Get used orders for the current buyer - returns all orders, frontend will filter"""
    logger.info(f"Fetching used orders for buyer: {current_user.email}, name: {current_user.last_name} {current_user.first_name}")
    
    # Get ALL used orders (not filtered by organization)
    # This allows buyers to see their orders regardless of which seller's organization
    orders = (
        db.query(GarageUsedOrder)
        .options(selectinload(GarageUsedOrder.items))
        .order_by(GarageUsedOrder.created_at.desc())
        .all()
    )
    
    logger.info(f"Total used orders in system: {len(orders)}")
    
    # Add organization name to each order
    result = []
    for order in orders:
        org = db.query(Organization).filter(Organization.id == order.organization_id).first()
        order_dict = {
            "id": order.id,
            "organization_id": order.organization_id,
            "organization_name": org.name if org else "Не указана",
            "buyer_name": order.buyer_name,
            "buyer_phone": order.buyer_phone,
            "buyer_email": order.buyer_email,
            "delivery_type": order.delivery_type,
            "delivery_address": order.delivery_address,
            "transport_company": order.transport_company,
            "pickup_address": order.pickup_address,
            "total_amount": order.total_amount,
            "is_paid": order.is_paid,
            "status_code": order.status_code,
            "created_at": order.created_at,
            "items": order.items,
        }
        result.append(order_dict)
    
    return result


@router.get("/purchases/new-orders", response_model=list[PurchasedNewOrderResponse])
def list_purchased_new_orders(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Get new orders for the current buyer - returns all orders, frontend will filter"""
    logger.info(f"Fetching new orders for buyer: {current_user.email}")
    
    # Get ALL new orders (not filtered by organization)
    orders = (
        db.query(GarageNewOrder)
        .options(selectinload(GarageNewOrder.items))
        .order_by(GarageNewOrder.created_at.desc())
        .all()
    )
    
    logger.info(f"Total new orders in system: {len(orders)}")
    
    # Add organization name to each order
    result = []
    for order in orders:
        org = db.query(Organization).filter(Organization.id == order.organization_id).first()
        order_dict = {
            "id": order.id,
            "organization_id": order.organization_id,
            "organization_name": org.name if org else "Не указана",
            "buyer_name": order.buyer_name,
            "buyer_phone": order.buyer_phone,
            "buyer_email": order.buyer_email,
            "delivery_type": order.delivery_type,
            "delivery_address": order.delivery_address,
            "transport_company": order.transport_company,
            "pickup_address": order.pickup_address,
            "total_amount": order.total_amount,
            "is_paid": order.is_paid,
            "status_code": order.status_code,
            "seller": order.seller,
            "deliver_in_parts": order.deliver_in_parts,
            "created_at": order.created_at,
            "items": order.items,
        }
        result.append(order_dict)
    
    return result

