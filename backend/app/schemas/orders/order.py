from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.storage_location import StorageLocation
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from app.schemas.storage_cell import ProductStorageCell

from app.schemas.storage_location import StorageLocation

class OrderStatusResponse(BaseModel):
    id: int
    name: str
    code: str

    class Config:
        from_attributes = True

class OrderItemCreate(BaseModel):
    name: str
    brand: str
    partnumber: str
    quantity: int
    price: float
    status_id: int
    product_id: Optional[int] = None

class SellerOrganizationResponse(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None

    class Config:
        from_attributes = True

class OrderItemResponse(BaseModel):
    id: int
    name: str
    brand: str
    partnumber: str
    quantity: int
    price: float
    status: OrderStatusResponse
    storage_location: Optional[StorageLocation] = None
    product_id: Optional[int] = None
    product_storage_cells: Optional[List[dict]] = None
    seller_organization_id: Optional[str] = None
    seller_organization: Optional[SellerOrganizationResponse] = None

    class Config:
        from_attributes = True

class NewPartsOrderCreate(BaseModel):
    seller: str
    deliver_in_parts: bool = False

class NewPartsOrderResponse(BaseModel):
    id: int
    seller: str
    deliver_in_parts: bool

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    # Информация о товарах
    items: List[OrderItemCreate]
    cart_item_ids: Optional[List[int]] = None  # IDs товаров из корзины (новые)
    used_cart_item_ids: Optional[List[int]] = None  # IDs товаров из корзины (б/у)
    new_parts_order: NewPartsOrderCreate

    # Информация о получателе
    recipient_name: str
    recipient_phone: str
    recipient_email: str

    # Информация о доставке
    delivery_type: str  # 'pickup' или 'transport'
    delivery_address: Optional[str] = None
    transport_company: Optional[str] = None
    pickup_address: Optional[str] = None

    # Общая сумма
    total_amount: float

class OrderResponse(BaseModel):
    id: int
    order_number: str
    recipient_name: str
    recipient_phone: str
    recipient_email: str
    delivery_type: str
    delivery_address: Optional[str]
    transport_company: Optional[str]
    pickup_address: Optional[str]
    total_amount: float
    is_paid: bool
    status: OrderStatusResponse
    created_at: datetime
    items: List[OrderItemResponse]
    new_parts_order: Optional[NewPartsOrderResponse]
    source: Optional[str] = 'garage'
    # Avito order ids can exceed JS safe integer range, send as string.
    avito_order_id: Optional[str] = None
    avito_status_code: Optional[str] = None
    avito_data: Optional[dict] = None
    avito_last_name: Optional[str] = None
    avito_first_name: Optional[str] = None
    avito_patronymic: Optional[str] = None

    class Config:
        from_attributes = True
