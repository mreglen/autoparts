from pydantic import BaseModel, EmailStr
from typing import Optional

from app.schemas.audit import AuditEventRow
from app.schemas.notification import NotificationPrefs

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
    public_code: str
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
    is_service_executor: bool | None = None
    
    class Config:
        extra = "ignore"

class UserResponse(BaseModel):
    id: int
    public_code: Optional[str] = None
    last_name: Optional[str] = None
    first_name: Optional[str] = None
    patronymic: Optional[str] = None
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_buyer: bool
    is_seller: bool
    is_admin: bool
    is_director: bool
    is_employee: bool
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    organization_phone: Optional[str] = None
    organization_is_autoservice: bool = False
    can_see_rossko_sales_report: bool = False
    is_service_executor: bool = False
    notification_prefs: NotificationPrefs = NotificationPrefs()

    class Config:
        from_attributes = True


class UserSessionBrief(BaseModel):
    id: int
    device_info: Optional[str] = None
    ip_address: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    last_activity: Optional[str] = None

    class Config:
        from_attributes = True


class AdminUserMarkupInfo(BaseModel):
    tier_override: Optional[str] = None
    tier_effective: str
    markup_percent: float
    buyer_markup_percent: float
    seller_markup_percent: float
    autoservice_markup_percent: float


class AdminUserListItem(UserResponse):
    organization_name: Optional[str] = None
    active_sessions_count: int = 0


class AdminUserDetail(AdminUserListItem):
    sessions: list[UserSessionBrief] = []
    markup: Optional[AdminUserMarkupInfo] = None


class AdminUserAuditResponse(BaseModel):
    rows: list[AuditEventRow] = []
    total: int = 0
    page: int = 1
    limit: int = 50
    pages: int = 0

class EmployeeCreate(BaseModel):
    last_name: str
    first_name: str
    patronymic: Optional[str] = None
    email: EmailStr
    phone: str
    password: str
    is_service_executor: bool = False