from pydantic import BaseModel, EmailStr

class SellerRegisterRequest(BaseModel):
    last_name: str
    first_name: str
    patronymic: str | None = None
    name_organization: str
    description_organization: str | None = None
    address_organization: str
    phone: str
    email: EmailStr

class SellerRegisterResponse(BaseModel):
    msg: str