---
agent: devin-local
session: possible-dewberry
created: 2026-10-11T17:06:00Z
---
# Детальные права на рабочие зоны в планировщике

Добавить детальные права на рабочие зоны (просмотр/редактирование/CalDAV) в модалке сотрудника без переключателя режимов - всё определяется автоматически по назначенным зонам и их правам.

# Детальные права на рабочие зоны в планировщике

## Краткое описание
Добавить детальные права на рабочие зоны (просмотр/редактирование/CalDAV) в модалке сотрудника без переключателя режимов - всё определяется автоматически по назначенным зонам и их правам.

---

## ЭТАП 1: Изменение модели EmployeeWorkZone

### Цель
Добавить три булевых поля в таблицу `employee_work_zones` для хранения прав на рабочие зоны. На одну зону может быть несколько прав одновременно.

### Что сделать

#### 1.1 Обновить модель
**Файл:** `backend/app/models/employee_work_zone.py`

Добавить поля:
```python
from sqlalchemy import Boolean

can_view = Column(Boolean, nullable=False, default=True)
can_edit = Column(Boolean, nullable=False, default=False)
can_caldav = Column(Boolean, nullable=False, default=False)
```

#### 1.2 Создать миграцию
**Файл:** `backend/app/db/schema_patches.py`

Добавить функцию:
```python
def ensure_employee_work_zones_mode_columns() -> None:
    """Добавить колонки режимов планировщика в employee_work_zones."""
    from sqlalchemy import inspect, text
    from app.db.database import engine
    import logging
    
    logger = logging.getLogger(__name__)
    inspector = inspect(engine)
    if "employee_work_zones" not in inspector.get_table_names():
        return
    
    columns = {col["name"] for col in inspector.get_columns("employee_work_zones")}
    statements = []
    
    if "can_view" not in columns:
        statements.append("ALTER TABLE employee_work_zones ADD COLUMN can_view BOOLEAN NOT NULL DEFAULT TRUE")
    if "can_edit" not in columns:
        statements.append("ALTER TABLE employee_work_zones ADD COLUMN can_edit BOOLEAN NOT NULL DEFAULT FALSE")
    if "can_caldav" not in columns:
        statements.append("ALTER TABLE employee_work_zones ADD COLUMN can_caldav BOOLEAN NOT NULL DEFAULT FALSE")
    
    if statements:
        with engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))
        logger.info("Applied employee_work_zones mode columns patch")
```

#### 1.3 Добавить в main.py
**Файл:** `backend/app/main.py`

Добавить импорт и вызов функции при запуске:
```python
from app.db.schema_patches import ensure_employee_work_zones_mode_columns
```

В функции запуска (после других schema patches):
```python
ensure_employee_work_zones_mode_columns()
```

---

## ЭТАП 2: Добавить новые права доступа

### Цель
Добавить права для режимов планировщика в систему разрешений.

### Что сделать

#### 2.1 Добавить константы прав
**Файл:** `backend/app/utils/autoservice_access.py`

Добавить:
```python
AUTOSERVICE_PERMISSION_PLANNER_VIEW = "autoservice.planner.view"
AUTOSERVICE_PERMISSION_PLANNER_EDIT = "autoservice.planner.edit"
AUTOSERVICE_PERMISSION_PLANNER_CALDAV = "autoservice.planner.caldav"
```

Добавить в `AUTOSERVICE_PERMISSION_CODES`.

#### 2.2 Создать SQL миграцию
**Файл:** `backend/migrations/add_planner_mode_permissions.sql`

```sql
INSERT INTO permissions (code, name)
SELECT 'autoservice.planner.view', 'Планировщик: просмотр'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'autoservice.planner.view');

INSERT INTO permissions (code, name)
SELECT 'autoservice.planner.edit', 'Планировщик: редактирование'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'autoservice.planner.edit');

INSERT INTO permissions (code, name)
SELECT 'autoservice.planner.caldav', 'Планировщик: календарь'
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'autoservice.planner.caldav');
```

#### 2.3 Добавить в schema_patches
**Файл:** `backend/app/db/schema_patches.py`

Добавить функцию для применения миграции:
```python
def ensure_planner_mode_permissions() -> None:
    """Добавить права для режимов планировщика."""
    from app.db.database import engine
    from sqlalchemy import text
    import logging
    from pathlib import Path
    
    logger = logging.getLogger(__name__)
    
    migration_path = Path(__file__).parent.parent.parent / "migrations" / "add_planner_mode_permissions.sql"
    if not migration_path.exists():
        logger.warning(f"Migration file not found: {migration_path}")
        return
    
    with open(migration_path, "r", encoding="utf-8") as f:
        sql = f.read()
    
    with engine.begin() as conn:
        conn.execute(text(sql))
    logger.info("Applied planner mode permissions migration")
```

#### 2.4 Добавить вызов в main.py
В функции запуска:
```python
ensure_planner_mode_permissions()
```

---

## ЭТАП 3: Обновить Pydantic-схемы

### Цель
Обновить схемы для работы с новыми полями прав.

### Что сделать

#### 3.1 Обновить EmployeeWorkZoneView
**Файл:** `backend/app/schemas/employee_work_zone.py`

Добавить поля:
```python
class EmployeeWorkZoneView(BaseModel):
    id: int
    work_zone_id: int
    work_zone_name: str
    can_view: bool
    can_edit: bool
    can_caldav: bool
    created_at: str
```

#### 3.2 Обновить EmployeeWorkZoneAssign
**Файл:** `backend/app/schemas/employee_work_zone.py`

Добавить поля:
```python
class EmployeeWorkZoneAssign(BaseModel):
    work_zone_id: int
    can_view: bool = True
    can_edit: bool = False
    can_caldav: bool = False
```

#### 3.3 Добавить схему для обновления прав
**Файл:** `backend/app/schemas/employee_work_zone.py`

```python
class EmployeeWorkZoneUpdate(BaseModel):
    can_view: bool | None = None
    can_edit: bool | None = None
    can_caldav: bool | None = None
```

---

## ЭТАП 4: Обновить API endpoints

### Цель
Обновить endpoints для работы с новыми полями прав.

### Что сделать

#### 4.1 Обновить list_employee_work_zones
**Файл:** `backend/app/routers/organization_employees.py`

Возврат `EmployeeWorkZoneView` с новыми полями.

#### 4.2 Обновить assign_work_zone_to_employee
Использовать новые поля из payload при создании: `can_view`, `can_edit`, `can_caldav`.

#### 4.3 Добавить endpoint для обновления прав
Добавить `PATCH /organizations/{org_id}/employee-cards/{card_id}/work-zones/{assignment_id}` для обновления прав на конкретную зону:
```python
@router.patch("/organizations/{org_id}/employee-cards/{card_id}/work-zones/{assignment_id}")
def update_employee_work_zone(...)
```

#### 4.4 Добавить endpoint для получения прав текущего пользователя
Добавить `GET /autoservice/planner/employee-work-zones` возвращает зоны с правами для текущего пользователя в планировщике.

---

## ЭТАП 5: Обновить фронтенд модалки рабочих зон

### Цель
Сделать сетку с тремя чекбоксами для каждой рабочей зоны.

### Что сделать

#### 5.1 Обновить WorkZoneAssignmentModal
**Файл:** `frontend/my-autoparts/src/components/Employees/WorkZoneAssignmentModal.jsx`

Изменить структуру на сетку с 4 колонками:
- Рабочая зона
- Просмотр
- Редактирование
- CalDAV

Для каждой зоны:
- Название зоны
- Чекбокс "Просмотр" (can_view)
- Чекбокс "Редактирование" (can_edit)
- Чекбокс "CalDAV" (can_caldav)

#### 5.2 Обновить состояние
Добавить для каждой зоны объект:
```javascript
{
  work_zone_id: 1,
  work_zone_name: "Электрик",
  can_view: true,
  can_edit: false,
  can_caldav: false
}
```

#### 5.3 Обновить сохранение
При сохранении отправлять объекты с тремя булевыми полями:
```javascript
{
  work_zone_id: 1,
  can_view: true,
  can_edit: false,
  can_caldav: false
}
```

#### 5.4 Обновить загрузку назначенных зон
Загружать зоны с их правами и мапить в состояние модалки.

---

## ЭТАП 6: Автоматическое определение прав в планировщике

### Цель
Планировщик автоматически определяет права пользователя по назначенным зонам без переключателя.

### Что сделать

#### 6.1 Добавить хук для прав на зоны
**Файл:** `frontend/my-autoparts/src/hooks/usePlannerWorkZonePermissions.js`

Создать хук для загрузки прав текущего пользователя на зоны:
```javascript
export function usePlannerWorkZonePermissions() {
  // Загружает GET /autoservice/planner/employee-work-zones
  // Возвращает мапу: work_zone_id -> { can_view, can_edit, can_caldav }
}
```

#### 6.2 Интегрировать в AutoservicePlannerPage
**Файл:** `frontend/my-autoparts/src/pages/Autoservice/AutoservicePlannerPage.jsx`

Использовать хук для получения прав при загрузке планировщика.

#### 6.3 Фильтрация элементов по правам
Фильтровать элементы планировщика по зонам:
- Показывать элементы из зон, где `can_view=True`
- Не показывать элементы из зон без прав просмотра

---

## ЭТАП 7: Отключение кнопок по правам

### Цель
Отключать кнопки создания/редактирования/удаления если нет прав на редактирование зоны.

### Что сделать

#### 7.1 В PlannerCellContextMenu
**Файл:** `frontend/my-autoparts/src/components/Autoservice/PlannerCellContextMenu.jsx`

Добавить проверку прав на зону элемента:
- Если `can_edit=False` для зоны, скрыть/отключить кнопки редактирования/удаления
- Показывать только "Просмотр"

#### 7.2 В PlannerCreateChoiceModal
Отключить создание заказа/записи в зоне если `can_edit=False`.

#### 7.3 В RepairOrderViewModal
Отключить редактирование если `can_edit=False` для зоны заказа.

#### 7.4 В InspectionBookingAddModal
Отключить создание записи если нет ни одной зоны с `can_edit=True`.

---

## ЭТАП 8: CalDAV синхронизация

### Цель
Синхронизировать только зоны с правом `can_caldav`.

### Что сделать

#### 8.1 Обновить Celery задачу sync_calendar_to_bookings
**Файл:** `backend/app/tasks/autoservice_caldav_tasks.py`

Фильтровать зоны по праву `can_caldav` текущего пользователя.

#### 8.2 Обновить export_bookings_to_calendar
**Файл:** `backend/app/services/autoservice_caldav.py`

Экспортировать только записи из зон с `can_caldav=True`.

---

## ЭТАП 9: Тестирование

### Цель
Проверить работу всех новых функций.

### Что сделать

#### 9.1 Тест модалки рабочих зон
- Открыть карточку сотрудника
- Нажать "Рабочие зоны"
- Проверить отображение сетки с 3 чекбоксами
- Сохранить различные комбинации прав
- Проверить сохранение в БД

#### 9.2 Тест планировщика без прав
- Отправить сотрудника без назначенных зон
- Открыть планировщик - должно быть пусто

#### 9.3 Тест планировщика с правами только на просмотр
- Назначить зону только с `can_view=True`
- Открыть планировщик - видны элементы этой зоны
- Попробовать редактировать - кнопки отключены

#### 9.4 Тест планировщика с правами на редактирование
- Назначить зону с `can_view=True` и `can_edit=True`
- Открыть планировщик - видны элементы
- Кнопки редактирования доступны

#### 9.5 Тест CalDAV
- Назначить зону с `can_caldav=True`
- Проверить синхронизацию этой зоны
- Зона без `can_caldav` не синхронизируется

---

## Риски и соображения

1. **Миграции:** Новые колонки в существующей таблице - безопасно с `ALTER TABLE`
2. **Совместимость:** По умолчанию `can_view=True`, существующие назначения сохранят просмотр
3. **UI сложность:** Сетка с чекбоксами на мобильных - нужно тестировать адаптивность
4. **Производительность:** Фильтрация по зонам - оптимизировать на backend при большом количестве элементов
5. **Без переключателя:** Пользователь может не понять почему кнопки отключены - нужно визуально подсвечивать права

---

## Порядок выполнения

1. ЭТАП 1: Изменить модель и миграцию
2. ЭТАП 2: Добавить новые права
3. ЭТАП 3: Обновить схемы
4. ЭТАП 4: Обновить API
5. ЭТАП 5: Обновить фронтенд модалки
6. ЭТАП 6: Автоматическое определение прав
7. ЭТАП 7: Отключение кнопок
8. ЭТАП 8: CalDAV синхронизация
9. ЭТАП 9: Тестирование
