from pydantic import BaseModel
from typing import Literal


TaskSeverity = Literal["high", "medium", "low"]


class DashboardTaskItem(BaseModel):
    id: str
    title: str
    count: int
    severity: TaskSeverity
    url: str
    hint: str | None = None


class DashboardTasksResponse(BaseModel):
    tasks: list[DashboardTaskItem]
