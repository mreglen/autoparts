import logging
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.database import get_db
from app.models.orders import Order, OrderStatus, AvitoOrderStatus
from app.models.organization_avito_integration import OrganizationAvitoIntegration
from app.models.user import User as UserModel
from app.schemas.avito_orders import (
    AvitoOrderSyncResponse,
    AvitoOrderTransitionRequest,
)
from app.services import avito_api as avito_api_svc
from app.services.avito_orders_api import (
    fetch_avito_orders,
    apply_order_transition,
    AvitoOrdersError,
)
from app.utils.avito_crypto import decrypt_secret

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Avito Orders"])


def _ensure_org_access(user: UserModel, org_id: str) -> None:
    if user.organization_id != org_id and not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа к организации")


def _get_avito_token_for_org(db: Session, org_id: str) -> tuple[str, int]:
    """Получить токен Авито для организации"""
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито не настроена"
        )
    
    if not integration.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито отключена"
        )
    
    try:
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = avito_api_svc.fetch_access_token(integration.client_id, secret)
        # fetch_access_token is async, so we need to handle it differently
        # For sync context, we'll need to use a different approach
        return token, int(integration.avito_user_id)
    except Exception as e:
        logger.exception("Error getting Avito token")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка получения токена Авито: {str(e)}"
        )


def _map_avito_status_to_internal(avito_status_code: str) -> str:
    """Маппинг статуса Авито на внутренний статус"""
    status_map = {
        'on_confirmation': 'pending',
        'ready_to_ship': 'confirmed',
        'in_transit': 'shipped',
        'delivered': 'delivered',
        'canceled': 'rejected',
        'closed': 'closed',
        'on_return': 'pending',  # Can be customized
        'in_dispute': 'pending',  # Can be customized
    }
    return status_map.get(avito_status_code, 'pending')


def _sync_avito_order_to_db(
    db: Session,
    org_id: str,
    avito_order: dict[str, Any],
    avito_order_id: int,
    owner_user_id: int
) -> tuple[bool, Optional[Order]]:
    """
    Синхронизировать заказ Авито в БД
    
    Args:
        owner_user_id: ID владельца организации (кто настроил интеграцию)
    
    Returns:
        (created, order) - created=True если создан новый, False если обновлен
    """
    # Проверяем существует ли заказ
    existing_order = db.query(Order).filter(
        Order.avito_order_id == avito_order_id
    ).first()
    
    # Получаем внутренний статус
    avito_status = avito_order.get('status', 'on_confirmation')
    internal_status_code = _map_avito_status_to_internal(avito_status)
    
    # Получаем или создаем внутренний статус
    internal_status = db.query(OrderStatus).filter(
        OrderStatus.code == internal_status_code
    ).first()
    
    if not internal_status:
        # Создаем статус если не существует
        internal_status = OrderStatus(
            code=internal_status_code,
            name=avito_status
        )
        db.add(internal_status)
        db.flush()
    
    # Извлекаем данные из заказа Авито
    buyer_info = avito_order.get('buyer', {})
    items = avito_order.get('items', [])
    
    # Calculate total
    total_amount = 0
    for item in items:
        price = item.get('price', 0)
        quantity = item.get('quantity', 1)
        total_amount += price * quantity
    
    # Если заказ уже существует - обновляем
    if existing_order:
        existing_order.avito_status_code = avito_status
        existing_order.status_id = internal_status.id
        existing_order.total_amount = total_amount
        existing_order.recipient_name = buyer_info.get('name', existing_order.recipient_name)
        existing_order.recipient_phone = buyer_info.get('phone', existing_order.recipient_phone)
        existing_order.recipient_email = buyer_info.get('email', existing_order.recipient_email)
        existing_order.avito_data = avito_order
        
        db.commit()
        db.refresh(existing_order)
        return False, existing_order
    
    # Создаем новый заказ
    # Генерируем номер заказа
    from sqlalchemy import func, cast, Integer
    max_order_number = db.query(func.max(cast(func.nullif(Order.order_number, ''), Integer))).scalar()
    next_number = (max_order_number or 0) + 1
    order_number = f"{next_number:09d}"
    
    new_order = Order(
        order_number=order_number,
        user_id=owner_user_id,  # Владелец организации, настроивший интеграцию
        source='avito',
        avito_order_id=avito_order_id,
        avito_status_code=avito_status,
        status_id=internal_status.id,
        recipient_name=buyer_info.get('name', 'Покупатель Авито'),
        recipient_phone=buyer_info.get('phone', ''),
        recipient_email=buyer_info.get('email', ''),
        delivery_type='transport',  # Default for Avito
        delivery_address=avito_order.get('delivery_address', ''),
        transport_company=avito_order.get('delivery_service', ''),
        total_amount=total_amount,
        is_paid=avito_order.get('is_paid', False),
        avito_data=avito_order
    )
    
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    return True, new_order


@router.get("/{org_id}/avito/orders/sync", response_model=AvitoOrderSyncResponse)
async def sync_avito_orders(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Синхронизировать заказы из Авито в БД
    
    Получает все заказы из API Авито и сохраняет/обновляет их в таблице orders
    """
    _ensure_org_access(current_user, org_id)
    
    # Получаем интеграцию
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито не настроена"
        )
    
    if not integration.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито отключена"
        )
    
    try:
        # Получаем токен
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        avito_user_id = int(integration.avito_user_id)
        
        # Находим владельца организации (кто настроил интеграцию)
        from app.models.user import User
        org_owner = db.query(User).filter(
            User.organization_id == org_id,
            User.is_admin == True
        ).first()
        
        if not org_owner:
            logger.warning(f"No admin user found for organization {org_id}, using user_id=1")
            owner_user_id = 1
        else:
            owner_user_id = org_owner.id
            logger.info(f"Using organization owner user_id: {owner_user_id} for org {org_id}")
        
        # Получаем все заказы (без фильтра по статусу)
        response = await fetch_avito_orders(token, avito_user_id)
        
        orders_data = response.get('orders', [])
        logger.info(f"Fetched {len(orders_data)} orders from Avito API for org {org_id}")
        created_count = 0
        updated_count = 0
        errors = []
        
        # Синхронизируем каждый заказ
        for avito_order in orders_data:
            try:
                avito_order_id = avito_order.get('id')
                if not avito_order_id:
                    errors.append(f"Order missing ID: {avito_order}")
                    continue
                
                created, order = _sync_avito_order_to_db(
                    db, org_id, avito_order, avito_order_id, owner_user_id
                )
                
                if created:
                    created_count += 1
                else:
                    updated_count += 1
                    
            except Exception as e:
                logger.exception(f"Error syncing order {avito_order.get('id')}")
                errors.append(f"Order {avito_order.get('id')}: {str(e)}")
        
        return AvitoOrderSyncResponse(
            synced_count=len(orders_data),
            created_count=created_count,
            updated_count=updated_count,
            errors=errors
        )
        
    except HTTPException:
        raise
    except AvitoOrdersError as e:
        # Возвращаем 400 вместо 502, если API Авито недоступен
        error_msg = str(e)
        logger.warning(f"Avito API error during sync: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка API Авито: {error_msg}"
        )
    except Exception as e:
        logger.exception("Error syncing Avito orders")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка синхронизации: {str(e)}"
        )


@router.post("/{org_id}/avito/orders/{avito_order_id}/transition")
async def apply_avito_order_transition(
    org_id: str,
    avito_order_id: int,
    body: AvitoOrderTransitionRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Изменить статус заказа Авито
    
    Вызывает API Авито applyTransition и обновляет статус в БД
    """
    _ensure_org_access(current_user, org_id)
    
    # Получаем заказ из БД
    order = db.query(Order).filter(
        Order.avito_order_id == avito_order_id,
        Order.source == 'avito'
    ).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Заказ Авито {avito_order_id} не найден"
        )
    
    # Получаем интеграцию
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито не настроена"
        )
    
    try:
        # Получаем токен
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        
        # Применяем переход в Авито
        result = await apply_order_transition(token, avito_order_id, body.transition)
        
        # Обновляем статус в БД
        # Получаем новый статус из результата
        new_avito_status = result.get('status', order.avito_status_code)
        internal_status_code = _map_avito_status_to_internal(new_avito_status)
        
        internal_status = db.query(OrderStatus).filter(
            OrderStatus.code == internal_status_code
        ).first()
        
        if internal_status:
            order.avito_status_code = new_avito_status
            order.status_id = internal_status.id
            order.avito_data = result
            db.commit()
        
        return {
            "ok": True,
            "result": result,
            "order_id": order.id,
            "avito_order_id": avito_order_id,
            "new_status": new_avito_status
        }
        
    except AvitoOrdersError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Ошибка API Авито: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Error applying transition to order {avito_order_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка изменения статуса: {str(e)}"
        )


@router.get("/{org_id}/avito/orders")
async def get_avito_orders(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Получить заказы Авито из БД
    """
    _ensure_org_access(current_user, org_id)
    
    orders = db.query(Order).filter(
        Order.source == 'avito'
    ).order_by(Order.created_at.desc()).all()
    
    return {
        "orders": [
            {
                "id": order.id,
                "order_number": order.order_number,
                "avito_order_id": order.avito_order_id,
                "avito_status": order.avito_status_code,
                "status": order.status.name if order.status else None,
                "recipient_name": order.recipient_name,
                "recipient_phone": order.recipient_phone,
                "total_amount": order.total_amount,
                "is_paid": order.is_paid,
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "source": order.source,
                "avito_data": order.avito_data
            }
            for order in orders
        ]
    }


@router.get("/{org_id}/avito/delivery/check")
async def check_avito_delivery(
    org_id: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Проверить подключена ли Авито Доставка для бизнеса
    
    Пытается получить список заказов. Если доставка не подключена,
    API вернёт ошибку с соответствующим сообщением.
    """
    _ensure_org_access(current_user, org_id)
    
    # Получаем интеграцию
    integration = db.query(OrganizationAvitoIntegration).filter(
        OrganizationAvitoIntegration.organization_id == org_id
    ).first()
    
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито не настроена"
        )
    
    if not integration.enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Интеграция с Авито отключена"
        )
    
    try:
        from app.services.avito_orders_api import fetch_avito_orders
        from app.utils.avito_crypto import decrypt_secret
        from app.services import avito_api as avito_api_svc
        
        secret = decrypt_secret(integration.client_secret_encrypted)
        token = await avito_api_svc.fetch_access_token(integration.client_id, secret)
        
        # Пытаемся получить заказы - если доставка не подключена, будет ошибка
        await fetch_avito_orders(token, int(integration.avito_user_id))
        
        return {
            "delivery_enabled": True,
            "message": None
        }
    except HTTPException:
        # Пробрасываем HTTP исключения как есть
        raise
    except Exception as e:
        error_msg = str(e).lower()
        
        # Проверяем, связана ли ошибка с отсутствием доставки
        # Avito может вернуть разные ошибки, если доставка не подключена
        delivery_not_enabled = any(keyword in error_msg for keyword in [
            'доставк',
            'delivery',
            'недоступн',
            'not available',
            'not enabled',
            'business delivery'
        ])
        
        if delivery_not_enabled or '403' in str(e) or '400' in str(e):
            return {
                "delivery_enabled": False,
                "message": "API работает только с Авито Доставкой для бизнеса. Чтобы её включить, нужно указать реквизиты компании и настроить тариф. Подробнее: avito.ru/general/dostavka"
            }
        
        # Другие ошибки
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка проверки доставки: {str(e)}"
        )
