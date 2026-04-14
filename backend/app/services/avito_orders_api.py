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
    statuses: Optional[list[str]] = None,
    ids: Optional[list[str]] = None,
    date_from: Optional[int] = None,
    page: Optional[int] = None,
    limit: Optional[int] = None
) -> dict[str, Any]:
    """
    Получение списка заказов из Авито
    
    GET https://api.avito.ru/order-management/1/orders
    
    Согласно документации: https://developers.avito.ru/api-catalog/order-management/documentation#operation/getOrders
    
    Args:
        access_token: Токен доступа Авито
        user_id: ID пользователя Авито (не используется в query params)
        statuses: Фильтр по статусам (опционально)
            Доступные статусы:
            - on_confirmation: ожидает подтверждения
            - ready_to_ship: ждет отправки
            - in_transit: в пути
            - canceled: отменный заказ
            - delivered: доставлен покупателю
            - on_return: на возврате
            - in_dispute: по заказу открыт спор
            - closed: заказ закрыт
        ids: Идентификаторы заказов (опционально)
        date_from: Метка времени (timestamp), с момента которого созданы покупки (опционально)
        page: Номер страницы для пагинации (опционально)
        limit: Максимальное количество заказов на странице (0-20) (опционально)
        
    Returns:
        Dict с данными о заказах
    """
    url = f"{AVITO_BASE}/order-management/1/orders"
    params = {}
    
    # Добавляем параметры согласно документации Avito
    if statuses:
        params["statuses"] = statuses
    
    if ids:
        params["ids"] = ids
    
    if date_from:
        params["dateFrom"] = date_from
    
    if page is not None:
        params["page"] = page
    
    if limit is not None:
        params["limit"] = min(limit, 20)  # Максимум 20 по документации
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    logger.info(f"Fetching Avito orders with params: {params}")
    logger.info(f"URL: {url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params, headers=headers)
            logger.info(f"Avito API Request: GET {url}")
            logger.info(f"Params: {params}")
            logger.info(f"Response Status: {response.status_code}")
            logger.info(f"Response Headers: {dict(response.headers)}")
            logger.info(f"Response Body: {response.text[:500]}")
            response.raise_for_status()
            data = response.json()
            logger.info(f"Received {len(data.get('orders', []))} orders from Avito API")
            
            # Log warning if empty orders list
            if not data.get('orders'):
                logger.warning("Avito API returned empty orders list")
                logger.warning(f"Full response: {data}")
            
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


async def raw_fetch_avito_orders(
    access_token: str,
    request_body: dict[str, Any]
) -> dict[str, Any]:
    """
    Сырой запрос к API заказов Авито
    
    GET https://api.avito.ru/order-management/1/orders
    
    Args:
        access_token: Токен доступа Авито
        request_body: Параметры запроса в формате, рекомендуемом Avito
        
    Returns:
        Dict с данными о заказах
    """
    url = f"{AVITO_BASE}/order-management/1/orders"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    logger.info(f"Сырой запрос к API заказов Авито с параметрами: {request_body}")
    logger.info(f"URL: {url}")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=request_body, headers=headers)
            logger.info(f"Запрос к API Авито: GET {url}")
            logger.info(f"Параметры запроса: {request_body}")
            logger.info(f"Статус ответа: {response.status_code}")
            logger.info(f"Заголовки ответа: {dict(response.headers)}")
            logger.info(f"Тело ответа: {response.text[:500]}")
            response.raise_for_status()
            data = response.json()
            logger.info(f"Получен сырой ответ от API Авито")
            return data
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP ошибка в сыром запросе к API заказов Авито: {e.response.status_code} - {e.response.text}")
        raise AvitoOrdersError(f"Ошибка API Авито: {e.response.status_code}")
    except Exception as e:
        logger.exception("Ошибка в сыром запросе к API заказов Авито")
        raise AvitoOrdersError(f"Ошибка выполнения запроса: {str(e)}")
