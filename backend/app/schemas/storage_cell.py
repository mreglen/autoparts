from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# Storage Cell Schemas
class StorageCellBase(BaseModel):
    name: str
    description: Optional[str] = None

class StorageCellCreate(StorageCellBase):
    storage_location_id: int

class StorageCellUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class StorageCell(StorageCellBase):
    id: int
    storage_location_id: int
    
    class Config:
        from_attributes = True

# Product Storage Cell Schemas
class ProductStorageCellBase(BaseModel):
    product_id: int
    storage_cell_id: int
    value: Optional[str] = None

class ProductStorageCellCreate(ProductStorageCellBase):
    pass

class ProductStorageCellUpdate(BaseModel):
    product_id: Optional[int] = None
    storage_cell_id: Optional[int] = None
    value: Optional[str] = None

class ProductStorageCell(ProductStorageCellBase):
    id: int
    
    class Config:
        from_attributes = True

class ProductStorageCellsByProductsRequest(BaseModel):
    product_ids: List[int] = Field(..., min_length=1, max_length=200)

# Response schemas with relationships
class StorageCellWithLocation(StorageCell):
    storage_location: Optional['StorageLocation'] = None

class StorageCellWithProducts(StorageCell):
    products: list['Product'] = []

class ProductWithStorageCells(BaseModel):
    id: int
    name: str
    storage_cells: list[StorageCell] = []
    
    class Config:
        from_attributes = True

# Pending Product Storage Cell Schemas
class PendingProductStorageCellBase(BaseModel):
    pending_product_id: int
    storage_cell_id: int
    value: Optional[str] = None

class PendingProductStorageCellCreate(PendingProductStorageCellBase):
    pass

class PendingProductStorageCellUpdate(BaseModel):
    pending_product_id: Optional[int] = None
    storage_cell_id: Optional[int] = None
    value: Optional[str] = None

class PendingProductStorageCell(PendingProductStorageCellBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class PendingProductStorageCellResponse(BaseModel):
    id: int
    product_id: int  # Alias for pending_product_id
    storage_cell_id: int
    value: Optional[str] = None
    storage_cell_name: str
    
    class Config:
        from_attributes = True

# Import for forward references
from .storage_location import StorageLocation
from .product import Product

StorageCellWithLocation.model_rebuild()
StorageCellWithProducts.model_rebuild()