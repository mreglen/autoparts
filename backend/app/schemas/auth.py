from typing import Optional

from fastapi import Form
from pydantic import BaseModel, EmailStr

from app.schemas.user import UserResponse


class UserRegister(BaseModel):
    last_name: str
    first_name: str
    patronymic: str | None = None
    email: EmailStr
    phone: str
    password: str
    organization_id: str

class UserLogin(BaseModel):
    login: str     
    password: str

    @classmethod
    def as_form(
        cls,
        login: str = Form(...),
        password: str = Form(...)
    ):

        return cls(login=login, password=password)

class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(Token):
    user: Optional[UserResponse] = None

class RegisterStep1(BaseModel):
    last_name: str
    first_name: str
    patronymic: str | None = None
    email: EmailStr
    phone: str
    password: str
    is_buyer: bool = False
    is_seller: bool = False
    name_organization: str | None = None  
    address_organization: str | None = None 
    
class VerifyCode(BaseModel):
    email: EmailStr
    code: str

class EmailOnly(BaseModel):
    email: EmailStr

class PasswordResetRequest(BaseModel):
    email: EmailStr  

class PasswordResetConfirm(BaseModel):
    email: EmailStr
    code: str
    new_password: str
