from pydantic import BaseModel

class StorageLocationBase(BaseModel):
    address: str

class StorageLocationCreate(StorageLocationBase):
    organization_id: str

class StorageLocation(StorageLocationBase):
    id: int
    organization_id: str

    class Config:
        from_attributes = True