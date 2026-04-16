---
name: Avito+Garage orders logic
overview: Сделать единый слой продаж/заказов для 3 источников (Авито, Свой гараж Б/У, Свой гараж новые) так, чтобы фронтовая таблица `SalesOrdersPage.jsx` корректно работала и права доступа соблюдались (новые — только для организаций, где директор `is_admin=true`).
todos:
  - id: design-db
    content: Спроектировать новые таблицы used/new/avito-cache и индексы под upsert Авито
    status: completed
  - id: backend-sales-router
    content: Добавить роутер `sales` с GET/PUT эндпоинтами под текущий фронт и правилами доступа
    status: completed
  - id: avito-sync
    content: Сделать сервис синхронизации Авито в БД и endpoint `POST /sales/avito-orders/sync`
    status: completed
  - id: migrations
    content: Добавить SQL миграции на создание таблиц заказов
    status: completed
  - id: frontend-adjust
    content: На фронте корректно обработать 403 для вкладки 'Новые' (скрыть/disabled, не ломать общую загрузку)
    status: completed
isProject: false
---

### Цель
- Поднять/восстановить бэкенд-эндпоинты, которые ожидает фронт: `GET /api/sales/used-parts-orders`, `GET /api/sales/new-parts-orders`, `GET /api/sales/avito-orders` и `PUT`-обновление статусов для used/new.
- Для Авито: хранить/обновлять заказы в БД (кэш/история), а не ходить в API на каждый заход.
- Для «Свой гараж (новые)»: вкладку/эндпоинты сделать доступными **только** организациям, у которых директор имеет `is_admin=true`.

### Что уже есть в проекте (опора)
- Фронт ожидает 3 набора заказов и разные поля:
  - Used/New: `id, buyer_name, buyer_phone, total_amount, status_code, created_at, items[]`.
  - Avito: `id, avito_order_id, avito_status_code, avito_data, total_amount, is_paid, created_at` (используется `avitoOrderDisplay`). См. `[.../backend/app/schemas/sales_orders.py](backend/app/schemas/sales_orders.py)` и `[.../frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx](frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx)`.
- Старые таблицы заказов удалены миграцией (`backend/migrations/delete.sql`), поэтому нужно **создать новые таблицы/модели** для used/new/avito.
- Для Авито уже есть клиент к API (`backend/app/services/avito_orders_api.py`) и хранение credentials на организацию (`backend/app/models/organization_avito_integration.py` используется в роутере Avito).

### Архитектура данных (новые таблицы)
- **Garage (БУ) заказы**
  - Таблица `garage_used_orders`:
    - `id`, `organization_id`, `buyer_name`, `buyer_phone`, `buyer_email`, `delivery_*`, `total_amount`, `is_paid`, `status_code`, `created_at`, `updated_at`.
  - Таблица `garage_used_order_items`:
    - `id`, `order_id`, `product_id (nullable)`, `name`, `brand`, `partnumber`, `quantity`, `price`, `status_code`.
- **Garage (новые) заказы** (отдельно, чтобы проще ограничивать доступ и не смешивать домены)
  - Таблица `garage_new_orders` + `garage_new_order_items` с теми же полями, плюс опционально `seller`, `deliver_in_parts` (как в `NewPartsOrderResponse`).
- **Avito заказы (кэш)**
  - Таблица `avito_orders_cache`:
    - `id`, `organization_id`, `avito_order_id (string, unique per org)`, `avito_status_code`, `avito_data (JSON/Text)`, `total_amount`, `is_paid`, `created_at (из Авито или время первого появления)`, `updated_at`, `synced_at`.
  - Важно: `avito_order_id` хранить строкой (см. уже имеющуюся практику в `backend/app/schemas/orders/order.py`).

### Роли/доступ (ключевая логика)
- Общий доступ к странице заказов уже решается фронтом по `user.is_admin || user.is_seller || permission sales.orders`.
- На бэкенде делаем такие правила:
  - **Used (БУ)**: продавец/админ/сотрудник с `sales.orders` — видит заказы своей организации (`organization_id == current_user.organization_id`), админ — может видеть по всем (опционально, через query `?org_id=`).
  - **New (новые)**: доступен только если `org_has_admin_director(org_id)=true`, где:
    - `org_has_admin_director` = в таблице `users` есть запись с `organization_id=org_id`, `is_director=true`, `is_admin=true`.
    - Админ (global) может обходить ограничение (по желанию), но вкладку/эндпоинты для обычных организаций закрываем `403`.
  - **Avito**: доступен продавцу/админу/сотруднику с правом и только для своей организации.

### API (совместимо с текущим фронтом)
- Новый роутер `backend/app/routers/sales.py` (будет подключён в `[.../backend/app/routers/__init__.py](backend/app/routers/__init__.py)`):
  - `GET /api/sales/used-parts-orders` → список `UsedPartsOrderResponse`.
  - `PUT /api/sales/used-parts-orders/{id}/status` → обновление `status_code`.
  - `GET /api/sales/new-parts-orders` → список `NewPartsOrderResponse` (с проверкой `org_has_admin_director`).
  - `PUT /api/sales/new-parts-orders/{id}/status` → обновление `status_code`.
  - `GET /api/sales/avito-orders` → список `AvitoOrderResponseV2` из кэша.
  - Дополнительно (для поддержки кэша):
    - `POST /api/sales/avito-orders/sync` → синхронизирует заказы из Авито API в `avito_orders_cache` для организации пользователя.

### Синхронизация Авито (кэш в БД)
- Реализовать сервис `sync_avito_orders_for_org(db, org_id)`:
  - Берёт `OrganizationAvitoIntegration` для `org_id`, получает токен через существующий `avito_api` (как в `avito_integration.py`), затем вызывает `fetch_avito_orders` из `backend/app/services/avito_orders_api.py`.
  - Upsert по ключу `(organization_id, avito_order_id)`.
  - В `avito_data` сохранять весь raw-order, чтобы фронт мог отображать любые поля через `avitoOrderDisplay`.
  - `total_amount` и `is_paid` вычислять/извлекать из raw (если в raw нет — хранить 0/False и отображать через `avitoOrderDisplay`).
- Триггеры синхронизации:
  - Минимум: ручная кнопка “Обновить” на фронте уже есть и может дергать `POST /sync` перед `GET`.
  - Опционально: периодическая синхронизация планировщиком (у вас уже есть APScheduler в `[.../backend/app/main.py](backend/app/main.py)`), но это можно добавить вторым шагом.

### Миграции/DDL
- Добавить SQL-миграцию(и) в `backend/migrations/` для создания новых таблиц и индексов:
  - уникальный индекс для `(organization_id, avito_order_id)`;
  - FK для `order_items.order_id`;
  - FK на `products.id` (nullable).

### Фронтенд (минимальные корректировки)
- Оставить текущие вкладки `used/new/avito` и формат данных.
- Добавить на фронте проверку доступа к вкладке “Новые” (скрывать таб, если бэкенд возвращает `403` или если в `user`/профиле есть флаг). Чтобы не делать лишний запрос, лучше вернуть в `/api/auth/me` или похожем профиле флаг `can_view_new_parts_orders`.
- При `fetchAll()`:
  - если `GET /new-parts-orders` вернул `403`, показывать вкладку disabled/скрывать и не считать ошибкой загрузки всей страницы.

### Тест-план (ручной)
- Пользователь организации без admin-директора:
  - `GET used` работает, `GET avito` работает (если есть кэш), `GET new` → 403; вкладка “Новые” скрыта/disabled.
- Пользователь организации с директором `is_admin=true`:
  - все 3 вкладки грузятся, статусы used/new обновляются.
- Админ:
  - видит всё (как минимум в своей организации), статусные обновления работают.

### Файлы, которые будут затронуты
- `backend/app/routers/__init__.py` — подключить `sales_router`.
- `backend/app/routers/sales.py` — новый роутер.
- `backend/app/models/...` — новые SQLAlchemy модели для 3 типов заказов.
- `backend/app/schemas/sales_orders.py` — использовать как основу/расширить при необходимости.
- `backend/migrations/*.sql` — DDL для новых таблиц.
- `frontend/my-autoparts/src/pages/Sales/SalesOrdersPage.jsx` — обработка 403 для “Новые” и (опционально) скрытие таба.
