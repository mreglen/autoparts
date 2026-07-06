from fastapi import APIRouter


router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/statuses/")
def get_order_statuses():
    """
    Minimal statuses list for SalesOrdersPage status dropdown.
    Garage used/new orders store `status_code` as plain string.
    """
    return [
        {"code": "pending", "name": "В ожидании"},
        {"code": "confirmed", "name": "Подтверждён"},
        {"code": "rejected", "name": "Не подтверждён"},
        {"code": "assembled", "name": "Сформирован"},
        {"code": "shipped", "name": "В доставке"},
        {"code": "delivered", "name": "Получен"},
        {"code": "closed", "name": "Закрыт"},
    ]

