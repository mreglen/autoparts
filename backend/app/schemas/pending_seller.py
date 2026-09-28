from pydantic import BaseModel, EmailStr, model_validator

class SellerRegisterRequest(BaseModel):
    last_name: str
    first_name: str
    patronymic: str | None = None
    name_organization: str
    description_organization: str | None = None
    address_organization: str
    phone: str
    email: EmailStr
    # Legacy payloads without wants_* are treated as seller=True, autoservice=False
    wants_seller: bool = True
    wants_autoservice: bool = False

    @model_validator(mode="after")
    def _at_least_one_direction(self):
        if not self.wants_seller and not self.wants_autoservice:
            raise ValueError("Выберите хотя бы одно направление: продавец или автосервис")
        return self

class SellerRegisterResponse(BaseModel):
    msg: str
