from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel

from app.schemas.autoservice_client import AutoserviceClientView
from app.schemas.chat import ChatResponse, ManageableUserItem


class AutoserviceChatOpenResponse(ChatResponse):
    pass


class AutoserviceChatVehicleBrief(BaseModel):
    id: int
    make: str
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    plate: Optional[str] = None
    vin: Optional[str] = None


class AutoserviceChatBookingBrief(BaseModel):
    id: int
    preferred_date: date
    preferred_time: Optional[time] = None
    status: str
    name: str
    vehicle_label: Optional[str] = None
    source: str
    created_at: datetime


class AutoserviceChatOrderBrief(BaseModel):
    id: int
    order_number: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    scheduled_end_at: Optional[datetime] = None
    vehicle_label: Optional[str] = None
    created_at: datetime


class AutoserviceChatClientProfile(BaseModel):
    chat_id: int
    client: Optional[AutoserviceClientView] = None
    client_user_id: Optional[int] = None
    vehicles: list[AutoserviceChatVehicleBrief] = []
    bookings: list[AutoserviceChatBookingBrief] = []
    orders: list[AutoserviceChatOrderBrief] = []


class AutoserviceChatParticipantAdd(BaseModel):
    user_id: int


class AutoserviceChatClientBrief(BaseModel):
    id: int
    name: str
    phone: str
    user_id: Optional[int] = None


class AutoserviceChatTopics(BaseModel):
    client: AutoserviceChatClientBrief
    bookings: list[AutoserviceChatBookingBrief] = []
    orders: list[AutoserviceChatOrderBrief] = []


class AutoserviceChatOpenForClientIn(BaseModel):
    client_id: Optional[int] = None
    booking_id: Optional[int] = None
    repair_order_id: Optional[int] = None


__all__ = [
    "AutoserviceChatOpenResponse",
    "AutoserviceChatVehicleBrief",
    "AutoserviceChatBookingBrief",
    "AutoserviceChatOrderBrief",
    "AutoserviceChatClientProfile",
    "AutoserviceChatParticipantAdd",
    "AutoserviceChatClientBrief",
    "AutoserviceChatTopics",
    "AutoserviceChatOpenForClientIn",
    "ManageableUserItem",
]
