---
name: new-endpoint
description: Создать FastAPI endpoint по конвенциям проекта (роутер + схема + organization_id)
---

Создай новый endpoint по конвенциям проекта:

1. Посмотри соседние роутеры в `backend/app/routers/` и повтори их стиль (DI `get_db`, зависимости авторизации, коды ошибок).
2. Pydantic-схемы — в `backend/app/schemas/` (Pydantic v2).
3. Нетривиальную логику — в `backend/app/services/`, в роутере только обвязка.
4. ОБЯЗАТЕЛЬНО: фильтр `organization_id` во всех запросах к сущностям организации (AGENTS.md §7.4).
5. `order_number` — строка: сравнения только со строками (`RepairOrder.order_number == "16"`).
6. Зарегистрируй роутер в `backend/app/main.py`.
7. Если меняется схема БД — патч в `backend/app/db/schema_patches.py` (посмотри существующие патчи).
8. Прогон `python -m unittest` по затронутым тестам.
