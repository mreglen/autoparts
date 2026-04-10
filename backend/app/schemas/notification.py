from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


class PushSubscriptionResponse(BaseModel):
    id: int
    user_id: int
    endpoint: str
    is_active: bool
    created_at: datetime
    last_used: Optional[datetime] = None
    
    class Config:
        from_attributes = True
