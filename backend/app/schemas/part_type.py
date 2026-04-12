from pydantic import BaseModel
from typing import Optional

class PartTypeBase(BaseModel):
    name: str

class PartTypeCreate(PartTypeBase):
    pass

class PartType(PartTypeBase):
    id: int
    
    class Config:
        from_attributes = True
