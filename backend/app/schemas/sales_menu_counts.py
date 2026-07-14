from pydantic import BaseModel, Field


class SalesMenuCountsResponse(BaseModel):
    orders: int = Field(0, description="Новые заказы (ожидают подтверждения)")
    returns: int = Field(0, description="Новые заявки на возврат (requested)")
    sales: int = Field(0, description="Сумма orders + returns для пункта «Продажи»")
