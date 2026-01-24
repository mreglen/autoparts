from pydantic import BaseModel, EmailStr
from typing import Optional

class UserBase(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    is_buyer: bool = False
    is_seller: bool = False
    is_director: bool


class UserCreate(UserBase):
    organization_id: str  

class User(UserBase):
    id: int
    organization_id: str

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    last_name: str | None = None
    first_name: str | None = None
    patronymic: str | None = None
    email: EmailStr | None = None      
    phone: str | None = None              
    password: str | None = None            

    class Config:
        extra = "ignore"

class UserResponse(BaseModel):
    id: int
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    email: str
    phone: Optional[str] = None
    is_buyer: bool
    is_seller: bool
    is_admin: bool
    is_director: bool
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    organization_phone: Optional[str] = None

    class Config:
        from_attributes = True 

class EmployeeCreate(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    password: str
    is_seller: bool = True