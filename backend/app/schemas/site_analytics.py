from datetime import date, datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


AnalyticsEventType = Literal["page_view", "heartbeat", "form_field", "form_submit", "conversion"]

ConversionEventName = Literal[
    "part_view",
    "add_to_cart",
    "show_phone",
    "chat_start",
    "order_placed",
]


class AnalyticsEventIn(BaseModel):
    type: AnalyticsEventType
    visitor_id: str = Field(..., min_length=8, max_length=64)
    path: Optional[str] = Field(None, max_length=2048)
    view_id: Optional[str] = Field(None, max_length=64)
    duration_sec: Optional[int] = Field(None, ge=0, le=86400)
    form_id: Optional[str] = Field(None, max_length=64)
    field_name: Optional[str] = Field(None, max_length=128)
    filled_fields: Optional[List[str]] = None
    event_name: Optional[ConversionEventName] = None
    product_id: Optional[int] = Field(None, ge=1)
    referrer: Optional[str] = Field(None, max_length=2048)
    utm_source: Optional[str] = Field(None, max_length=128)
    utm_medium: Optional[str] = Field(None, max_length=128)
    utm_campaign: Optional[str] = Field(None, max_length=128)


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


class AnalyticsFunnelStepOut(BaseModel):
    event_type: str
    count: int
    conversion_rate: Optional[float] = None


class AnalyticsFunnelOut(BaseModel):
    days: int
    steps: List[AnalyticsFunnelStepOut]


class AnalyticsSourceRowOut(BaseModel):
    traffic_source: str
    sessions: int
    page_views: int
    part_views: int = 0
    add_to_cart: int = 0
    show_phone: int = 0
    chat_start: int = 0
    order_placed: int = 0


class AnalyticsSourcesOut(BaseModel):
    days: int
    items: List[AnalyticsSourceRowOut]


class AnalyticsLandingRowOut(BaseModel):
    path_template: str
    landing_path: str
    views: int
    unique_visitors: int
    part_views: int = 0
    add_to_cart: int = 0
    show_phone: int = 0
    chat_start: int = 0
    order_placed: int = 0
    conversion_rate: float = 0.0


class AnalyticsLandingsOut(BaseModel):
    days: int
    items: List[AnalyticsLandingRowOut]


class AnalyticsConversionTrendRowOut(BaseModel):
    day: date
    part_view: int = 0
    add_to_cart: int = 0
    show_phone: int = 0
    chat_start: int = 0
    order_placed: int = 0


class AnalyticsConversionTrendOut(BaseModel):
    days: int
    items: List[AnalyticsConversionTrendRowOut]


class AnalyticsQueryReviewItemOut(BaseModel):
    query: str
    cluster: str
    impressions: float
    clicks: float
    ctr: float
    position: float
    matched_path: Optional[str] = None
    recommendation: str
    recommendation_label: str


class AnalyticsQueryReviewSnapshotOut(BaseModel):
    id: int
    created_at: datetime
    period_start: date
    period_end: date
    source: str
    status: str
    error_message: Optional[str] = None
    items: List[AnalyticsQueryReviewItemOut] = []
