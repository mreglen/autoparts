from pydantic import BaseModel
from typing import Optional
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

# Import for forward references
from .storage_location import StorageLocation
from .product import Product

StorageCellWithLocation.model_rebuild()
StorageCellWithProducts.model_rebuild()