from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CaldavStatusView(BaseModel):
    enabled: bool
    configured: bool
    username: Optional[str] = None
    server_url: Optional[str] = None
    last_synced_at: Optional[datetime] = None


class CaldavCredentialsView(BaseModel):
    server_url: str
    username: str
    password: str
