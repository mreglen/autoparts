from pydantic import BaseModel, EmailStr
from typing import Optional

class ClientBase(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    organization_id: str

class ClientCreate(ClientBase):
    pass

class ClientUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class Client(ClientBase):
    id: int

    class Config:
        from_attributes = True

class ClientResponse(BaseModel):
    id: int
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: str
    phone: str
    organization_id: str
    organization_name: Optional[str] = None

    class Config:
        from_attributes = True

    @property
    def full_name(self):
        """Return full name of the client"""
        name_parts = [self.last_name, self.first_name]
        if self.patronymic:
            name_parts.append(self.patronymic)
        return " ".join(name_parts)