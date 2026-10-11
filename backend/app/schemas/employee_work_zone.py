from pydantic import BaseModel


class EmployeeWorkZoneAssign(BaseModel):
    """Назначение зоны сотруднику."""
    work_zone_id: int


class EmployeeWorkZoneView(BaseModel):
    """Назначенная зона сотрудника."""
    id: int
    work_zone_id: int
    work_zone_name: str
    created_at: str

    class Config:
        from_attributes = True
