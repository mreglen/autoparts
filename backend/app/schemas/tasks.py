from typing import Any, Optional

from pydantic import BaseModel


class TaskStatusResponse(BaseModel):
    state: str
    progress: Optional[int] = None
    result: Optional[Any] = None
    error: Optional[str] = None
