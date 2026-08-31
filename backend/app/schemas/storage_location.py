from typing import Optional

from pydantic import BaseModel


class StorageLocationBase(BaseModel):
    address: str


class StorageLocationCreate(StorageLocationBase):
    organization_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class StorageLocation(StorageLocationBase):
    id: int
    organization_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True
