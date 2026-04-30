from typing import Any, Optional
from pydantic import BaseModel, Field


class AvitoOrderItem(BaseModel):
    """Элемент заказа Авито"""
    id: Optional[int] = None
    name: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None


class AvitoOrderResponse(BaseModel):
    """Ответ API Авито с данными заказа"""
    id: int
    status: Optional[str] = None
    created_at: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_phone: Optional[str] = None
    total_price: Optional[float] = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    delivery_info: Optional[dict[str, Any]] = None
    payment_info: Optional[dict[str, Any]] = None


class AvitoOrdersListResponse(BaseModel):
    """Ответ API Авито со списком заказов"""
    orders: list[dict[str, Any]] = Field(default_factory=list)
    total: Optional[int] = None


class AvitoOrderTransitionRequest(BaseModel):
    """Запрос на изменение статуса заказа Авито"""
    transition: str = Field(..., description="Тип перехода: confirm, reject, perform, receive")
    params: Optional[dict[str, Any]] = Field(
        default=None,
        description="Дополнительные параметры перехода (например params.cnc.confirmCode/marketplaceId)"
    )


class AvitoCncSetDetailsRequest(BaseModel):
    """Подготовка CNC-заказа перед получением."""
    address: str = Field(..., description="Адрес получения товара")
    booking_period: int = Field(..., ge=1, description="Срок бронирования товара в днях")
    details: Optional[str] = Field(default=None, description="Комментарий для покупателя")
    marketplace_id: Optional[str] = Field(default=None, description="Marketplace ID из данных заказа")


class AvitoOrderSyncResponse(BaseModel):
    """Ответ после синхронизации заказов Авито"""
    synced_count: int = Field(..., description="Количество синхронизированных заказов")
    created_count: int = Field(..., description="Количество созданных заказов")
    updated_count: int = Field(..., description="Количество обновленных заказов")
    errors: list[str] = Field(default_factory=list, description="Список ошибок")


class AvitoRawOrderRequest(BaseModel):
    """Сырой запрос к API заказов Авито"""
    statuses: Optional[list[str]] = Field(default=None, description="Фильтр по статусам заказов")
    ids: Optional[list[str]] = Field(default=None, description="Идентификаторы заказов")
    dateFrom: Optional[int] = Field(default=None, description="Timestamp, с момента которого созданы покупки")
    page: Optional[int] = Field(default=None, description="Номер страницы для пагинации")
    limit: Optional[int] = Field(default=None, description="Максимальное количество заказов на странице (0-20)")
