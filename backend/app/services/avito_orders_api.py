import logging
from typing import Any, Optional

import httpx

from app.services.avito_api import AVITO_BASE

logger = logging.getLogger(__name__)


class AvitoOrdersError(RuntimeError):
    """Ошибка при работе с API заказов Авито"""
    pass


async def fetch_avito_orders(
    access_token: str,
    user_id: int,
    status: Optional[str] = None
) -> dict[str, Any]:
    """
    Получение списка заказов из Авито
    
    GET https://api.avito.ru/order-management/1/orders
    
    Args:
        access_token: Токен доступа Авито
        user_id: ID пользователя Авито
        status: Фильтр по статусу (опционально)
        
    Returns:
        Dict с данными о заказах
    """
    url = f"{AVITO_BASE}/order-management/1/orders"
    params = {"user_id": user_id}
    
    if status:
        params["status"] = status
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    logger.info(f"Fetching Avito orders with status filter: {status}")
    logger.info(f"URL: {url}, Params: {params}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            logger.info(f"Avito API response status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            logger.info(f"Received {len(data.get('orders', []))} orders from Avito API")
            return data
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching Avito orders: {e.response.status_code} - {e.response.text}")
        raise AvitoOrdersError(f"Ошибка API Авито: {e.response.status_code}")
    except Exception as e:
        logger.exception("Error fetching Avito orders")
        raise AvitoOrdersError(f"Ошибка получения заказов: {str(e)}")


async def get_avito_order(
    access_token: str,
    user_id: int,
    order_id: int
) -> dict[str, Any]:
    """
    Получение деталей конкретного заказа
    
    GET https://api.avito.ru/order-management/1/orders/{order_id}
    
    Args:
        access_token: Токен доступа Авито
        user_id: ID пользователя Авито
        order_id: ID заказа в Авито
        
    Returns:
        Dict с данными заказа
    """
    url = f"{AVITO_BASE}/order-management/1/orders/{order_id}"
    params = {"user_id": user_id}
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching Avito order {order_id}: {e.response.status_code} - {e.response.text}")
        raise AvitoOrdersError(f"Ошибка API Авито: {e.response.status_code}")
    except Exception as e:
        logger.exception(f"Error fetching Avito order {order_id}")
        raise AvitoOrdersError(f"Ошибка получения заказа: {str(e)}")


async def apply_order_transition(
    access_token: str,
    order_id: int,
    transition: str
) -> dict[str, Any]:
    """
    Изменение статуса заказа
    
    POST https://api.avito.ru/order-management/1/order/applyTransition
    
    Доступные переходы (transitions):
    - confirm: on_confirmation → ready_to_ship
    - ship: ready_to_ship → in_transit
    - deliver: in_transit → delivered
    - cancel: любой → canceled
    - return: delivered → on_return
    - close: on_return → closed
    
    Args:
        access_token: Токен доступа Авито
        order_id: ID заказа в Авито
        transition: Тип перехода (confirm, ship, deliver, cancel, return, close)
        
    Returns:
        Dict с результатом операции
    """
    url = f"{AVITO_BASE}/order-management/1/order/applyTransition"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    body = {
        "order_id": order_id,
        "transition": transition
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=body, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error applying transition {transition} to order {order_id}: {e.response.status_code} - {e.response.text}")
        raise AvitoOrdersError(f"Ошибка API Авито: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        logger.exception(f"Error applying transition {transition} to order {order_id}")
        raise AvitoOrdersError(f"Ошибка изменения статуса: {str(e)}")


async def get_available_transitions(
    access_token: str,
    user_id: int,
    order_id: int
) -> list[str]:
    """
    Получение доступных переходов для заказа
    
    GET https://api.avito.ru/order-management/1/orders/{order_id}/transitions
    
    Args:
        access_token: Токен доступа Авито
        user_id: ID пользователя Авито
        order_id: ID заказа в Авито
        
    Returns:
        List доступных переходов
    """
    url = f"{AVITO_BASE}/order-management/1/orders/{order_id}/transitions"
    params = {"user_id": user_id}
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("transitions", [])
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching transitions for order {order_id}: {e.response.status_code} - {e.response.text}")
        raise AvitoOrdersError(f"Ошибка API Авито: {e.response.status_code}")
    except Exception as e:
        logger.exception(f"Error fetching transitions for order {order_id}")
        raise AvitoOrdersError(f"Ошибка получения доступных переходов: {str(e)}")
