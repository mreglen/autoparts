from pydantic import BaseModel


class EmployeeWorkZoneAssign(BaseModel):
    """Назначение зоны сотруднику с правами планировщика (work_zone_id=null — «Без рабочей зоны»)."""
    work_zone_id: int | None = None
    can_view: bool = True
    can_edit: bool = False
    can_caldav: bool = False


class EmployeeWorkZoneUpdate(BaseModel):
    """Обновление прав на назначенную зону."""
    can_view: bool | None = None
    can_edit: bool | None = None
    can_caldav: bool | None = None


class EmployeeWorkZoneView(BaseModel):
    """Назначенная зона сотрудника."""
    id: int
    work_zone_id: int | None
    work_zone_name: str
    can_view: bool
    can_edit: bool
    can_caldav: bool
    created_at: str

    class Config:
        from_attributes = True
