from datetime import datetime
from pydantic import BaseModel

class EventLogResponse(BaseModel):
    id: int
    event_type: str
    user_id: int | None
    email: str | None
    details: str | None
    created_at: datetime

    class Config:
        from_attributes = True