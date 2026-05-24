from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


AnalyticsEventType = Literal["page_view", "heartbeat", "form_field", "form_submit"]


class AnalyticsEventIn(BaseModel):
    type: AnalyticsEventType
    visitor_id: str = Field(..., min_length=8, max_length=64)
    path: Optional[str] = Field(None, max_length=2048)
    view_id: Optional[str] = Field(None, max_length=64)
    duration_sec: Optional[int] = Field(None, ge=0, le=86400)
    form_id: Optional[str] = Field(None, max_length=64)
    field_name: Optional[str] = Field(None, max_length=128)
    filled_fields: Optional[List[str]] = None


class AnalyticsEventsBatchIn(BaseModel):
    events: List[AnalyticsEventIn] = Field(..., min_length=1, max_length=50)


class AnalyticsSummaryOut(BaseModel):
    days: int
    page_views: int
    unique_visitors: int
    avg_session_duration_sec: float
    active_today: int


class AnalyticsPageRowOut(BaseModel):
    path_template: str
    views: int
    unique_visitors: int
    avg_duration_sec: float


class AnalyticsPagesOut(BaseModel):
    days: int
    items: List[AnalyticsPageRowOut]


class AnalyticsFormRowOut(BaseModel):
    form_id: str
    field_name: Optional[str]
    fill_count: int
    submit_count: int


class AnalyticsFormsOut(BaseModel):
    days: int
    items: List[AnalyticsFormRowOut]


class AnalyticsActivityRowOut(BaseModel):
    day: date
    page_views: int
    unique_visitors: int


class AnalyticsActivityOut(BaseModel):
    days: int
    items: List[AnalyticsActivityRowOut]


class AnalyticsPageDetailOut(BaseModel):
    days: int
    path_template: str
    page_views: int
    unique_visitors: int
    avg_duration_sec: float
    activity: List[AnalyticsActivityRowOut]
    instances: List["AnalyticsPageInstanceRowOut"] = []


class AnalyticsPageInstanceRowOut(BaseModel):
    path_raw: str
    views: int
    unique_visitors: int
    avg_duration_sec: float


class AnalyticsProductCardRowOut(BaseModel):
    product_id: Optional[int]
    path_raw: str
    brand: Optional[str] = None
    article: Optional[str] = None
    name: Optional[str] = None
    views: int
    unique_visitors: int
    avg_duration_sec: float


class AnalyticsProductCardsOut(BaseModel):
    days: int
    total_views: int
    unique_cards: int
    items: List[AnalyticsProductCardRowOut]
