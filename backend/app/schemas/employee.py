from pydantic import BaseModel, EmailStr
from typing import List, Optional
from enum import Enum


class EmployeeBase(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    is_director: bool = False


class EmployeeCreate(EmployeeBase):
    organization_id: str
    password: str


class EmployeeUpdate(BaseModel):
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    phone: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: str
    phone: str
    is_buyer: bool
    is_seller: bool
    is_admin: bool
    is_director: bool
    is_employee: bool
    organization_id: str

    class Config:
        from_attributes = True


class EmployeeRegistrationStep1(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    password: str


class PermissionAssignRequest(BaseModel):
    employee_id: int
    permission_ids: List[int]


class PermissionResponse(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class EmployeeWithPermissionsResponse(EmployeeResponse):
    permissions: List[PermissionResponse]

    class Config:
        from_attributes = True