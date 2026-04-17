from __future__ import annotations

import logging
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
from app.schemas.avito_orders import AvitoOrderTransitionRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sales", tags=["Sales"])


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
    from app.services.avito_orders_api import apply_order_transition
    
    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        
        # Build params based on order type and transition
        # For CNC orders, we may need confirmCode and marketplaceId
        transition_params = payload.params or {}
        
        # Extract avito_data to check delivery type
        avito_data = order.avito_data or {}
        delivery_info = avito_data.get('delivery', {})
        delivery_type = delivery_info.get('type', '')
        
        # For CNC (Самовывоз) orders with confirm transition, need additional params
        if delivery_type == 'cnc' and payload.transition == 'confirm':
            # Check if params are provided, otherwise use defaults from order
            if not transition_params.get('cnc'):
                # Try to extract from schedules or other fields
                marketplace_id = order.marketplace_id or avito_data.get('marketplaceId', '')
                if marketplace_id:
                    transition_params['cnc'] = {
                        'marketplaceId': str(marketplace_id)
                    }
        
        result = await apply_order_transition(
            token,
            int(order.avito_order_id),
            payload.transition,
            transition_params if transition_params else None
        )
        
        # Update status in database based on transition
        status_map = {
            'confirm': 'ready_to_ship',
            'reject': 'canceled',
            'perform': 'in_transit',
            'receive': 'delivered',
        }
        order.avito_status_code = status_map.get(payload.transition, order.avito_status_code)
        db.commit()
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error applying Avito transition for order {order_id}")
        # Provide more specific error message
        error_msg = str(e)
        if 'CNC' in error_msg or 'cnc' in error_msg:
            raise HTTPException(
                status_code=400, 
                detail=f"Ошибка для заказа самовывоза (CNC): {error_msg}. Для подтверждения CNC заказа требуется код подтверждения."
            )
        raise HTTPException(status_code=502, detail=f"Ошибка вызова API Авито: {error_msg}")


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
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        
        transitions = await get_available_transitions(
            token,
            int(integration.avito_user_id),
            int(order.avito_order_id)
        )
        
        return {"transitions": transitions}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching Avito transitions for order {order_id}")
        raise HTTPException(status_code=502, detail=f"Ошибка вызова API Авито: {str(e)}")


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

