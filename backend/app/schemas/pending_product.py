from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import datetime


class PendingProductBase(BaseModel):
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    is_new: bool = True
    price: Optional[float] = None
    quantity: Optional[int] = None
    storage_location_id: Optional[int] = None
    photos: Optional[List[str]] = None
    vehicle_ids: Optional[List[int]] = None
    
    @model_validator(mode='after')
    def validate_all_fields(self):
        # Validate required string fields
        if not self.article or not isinstance(self.article, str) or not self.article.strip():
            raise ValueError('Артикул не может быть пустым')
        if not self.name or not isinstance(self.name, str) or not self.name.strip():
            raise ValueError('Наименование не может быть пустым')
        if not self.brand or not isinstance(self.brand, str) or not self.brand.strip():
            raise ValueError('Бренд не может быть пустым')
        
        # Validate numeric fields
        if self.price is None or self.price < 0:
            raise ValueError('Цена должна быть положительным числом')
        if self.quantity is None or self.quantity < 0:
            raise ValueError('Количество должно быть неотрицательным целым числом')
        if self.storage_location_id is None or self.storage_location_id <= 0:
            raise ValueError('Выберите корректное место хранения')
        
        return self


class PendingProductCreate(PendingProductBase):
    pass


class PendingProductUpdate(BaseModel):
    article: Optional[str] = None
    name: Optional[str] = None
    brand: Optional[str] = None
    description: Optional[str] = None
    is_new: Optional[bool] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    storage_location_id: Optional[int] = None
    photos: Optional[List[str]] = None
    vehicle_ids: Optional[List[int]] = None


class PendingProduct(PendingProductBase):
    id: int
    internal_code: str
    organization_id: str
    created_by: int
    created_at: datetime
    creator_name: Optional[str] = None

    class Config:
        from_attributes = True