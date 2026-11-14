# Этап 22 — Бэкенд клиентского контура (мульти-СТО + клиентский PDF)

Довести клиентское `/me`-API до полного мульти-СТО (org-фильтры, org-поля в ответах, ownership по всем карточкам клиента), добавить клиентский PDF заказ-наряда, регенерировать OpenAPI/типы мобильного клиента и покрыть тестами — без изменения дефолтного поведения веба.

## Summary

Этап 22 карты `mobile/docs/PLAN-client.md` — бэкенд-контур клиентской роли. Решения пользователя: авторизация — email/телефон + пароль как на сайте (OTP не делаем); мульти-СТО — полный (клиент может быть клиентом нескольких автосервисов); PDF — клиентский вариант без закупочных цен и маржи.

**Ключевая находка исследования:** клиентский API уже на ~80% готов — `/autoservice/clients/me` + `/me/orgs`, `/autoservice/garage/vehicles` (с `organization_id`), `/autoservice/repair-orders/me`, `/autoservice/inspection-bookings/me` (уже мульти-орг), `/public/autoservice/organizations`, `become_autoservice_client`. PDF-шаблон `repair_order.html` уже клиентский по ценам (только `unit_price`/`price_with_markup`/`line_sum`, закупочных цен в контексте нет). Объём этапа — выравнивание multi-org в `/me`-эндпоинтах, клиентский PDF, схемы и регенерация OpenAPI для мобильного клиента.

## Текущее состояние (проверено по коду)

- `GET /autoservice/repair-orders/me` — single-org через `require_my_active_autoservice_client` (default org), фильтр `client_id == client.id` (одна карточка, без related_ids), **без `organization_id` и без пагинации** (`limit/offset` есть только у staff-списка).
- `GET /autoservice/repair-orders/me/{order_id}` — та же single-org проверка → заказ из другого СТО клиента отдаст 404.
- `GET /autoservice/repair-orders/{order_id}/pdf` — staff-only (`require_orders_access`).
- `RepairOrderClientView` — нет `organization_id`/`organization_name` (у `InspectionBookingView` они уже есть — прецедент).
- `GET /autoservice/garage/vehicles` — уже принимает `organization_id`; без него — default org (веб `GaragePage` зовёт без параметра → **дефолт не трогаем**).
- `GET /autoservice/inspection-bookings/me` — уже агрегирует по всем orgs клиента (`client_id IN related_ids OR created_by_user_id`), отдаёт `organization_id`+`organization_name`.
- `related_autoservice_client_ids(db, client, include_phone_matches=False)` — безопасная склейка по `user_id` (без fuzzy по хвосту телефона — тот остаётся «второй очередью»).
- JWT: `sub`=email, `get_current_user` резолвит через email+`session_token` → claim `user_id` **не нужен** (не блокер, фиксируем решением).
- `export_openapi.py` — мобильный срез по префиксам; `/api/public/autoservice/*` **не покрыт** → публичный список СТО не попадёт в `openapi.json`.
- Rate-limit/сессии: `client_kind` (ios/android) уже приоритетнее при вытеснении сессий (`cleanup_old_user_sessions`), `X-App-*` уже логируются.

## Implementation Steps

### 1. `backend/app/utils/autoservice_access.py` — хелперы мульти-орг

- `my_active_autoservice_client_cards(db, user) -> list[AutoserviceClient]` — все активные карточки клиента по всем автосервис-организациям (join `Organization`: `is_autoservice`, не `autoservice_paused`, `status='active'`, `user_id == user.id`), отсортированные по имени организации.
- `my_related_client_ids_by_org(db, user) -> dict[str, set[int]]` — для каждой карточки `related_autoservice_client_ids(db, card, include_phone_matches=False)`; плоский `set` тоже вернуть для проверок ownership.

### 2. `backend/app/schemas/repair_order.py`

- `RepairOrderClientView` += `organization_id: Optional[str] = None`, `organization_name: Optional[str] = None` (по прецеденту `InspectionBookingView`).

### 3. `backend/app/routers/autoservice_repair_orders.py`

- `_order_query`: добавить `joinedload(RepairOrder.organization)` (нужен для org-полей; безопасно и для staff-путей).
- `_to_client_view`: заполнить `organization_id=row.organization_id`, `organization_name=row.organization.name`.
- `list_my_repair_orders` (`GET /autoservice/repair-orders/me`):
  - новый опциональный `organization_id: str | None = Query(None, max_length=10)`;
  - передан → `resolve_active_autoservice_org_or_404` + `my_active_autoservice_client(db, user, org_id)` (None → 403, как сейчас); не передан → `require_my_active_autoservice_client` (**дефолт не меняется — веб не ломаем**);
  - фильтр `client_id == client.id` → `client_id.in_(related_autoservice_client_ids(db, client, include_phone_matches=False))` — заказ-наряды на дублирующих user-linked карточках того же аккаунта становятся видны (фикс, паритет с bookings);
  - `scope`/`order_by` без изменений.
- `get_my_repair_order` (`GET /me/{order_id}`): ownership-проверка по **всем** карточкам пользователя во всех СТО (`client_id IN` плоский набор related ids), а не только default org — иначе мульти-СТО деталь 404-ит. 404 при чужом заказе — как сейчас.
- **Новый** `get_my_repair_order_pdf` (`GET /autoservice/repair-orders/me/{order_id}/pdf`):
  - та же ownership-проверка, что у detail;
  - внутри `_to_staff_view(db, row)` → `render_repair_order_html(view, row.organization)` → `render_document_pdf_bytes` → `Response(application/pdf)` + `Content-Disposition` через `repair_order_pdf_filename`/`content_disposition`;
  - `log_autoservice(event_type="autoservice_document_downloaded", details={"document": "order", "channel": "client"})`;
  - клиентский вариант достигается самим шаблоном: в контекст попадают только розничные цены (`unit_price`, `price_with_markup`, `line_sum`), закупочных цен и маржи там нет — отдельный макет не нужен (проверено по `build_repair_order_context`). `staff_comment` в PDF идёт так же, как в веб-печати `RepairOrderPrintPage` — паритет сохраняем.
- `create/list/patch` repair-bookings (deprecated-алиасы на InspectionBooking) — **не трогаем**: приложение использует `/inspection-bookings/me`.

### 4. `backend/scripts/export_openapi.py`

- В `MOBILE_PATH_PREFIXES` добавить `"/api/public/autoservice/"` — иначе `/public/autoservice/organizations` и `inspection-bookings` не попадут в мобильный срез.

### 5. Тесты — `backend/tests/test_autoservice_client_contour.py` (новый)

Стиль — как `test_autoservice_access.py`/`test_autoservice_p1.py` (unittest + TestClient/SQLite-фикстуры — уточнить по соседним тестам при реализации):

- `repair-orders/me?organization_id=X` фильтрует по карточке в org X; без параметра — default org (регрессия веба).
- Заказ на дублирующей user-linked карточке виден в `/me` (related_ids).
- `/me/{id}` отдаёт заказ из **не-default** org при наличии карточки; 404 для чужого заказа.
- `/me/{id}/pdf`: 200 + `application/pdf` владельцу, 404 чужому; событие в audit-логе.
- `RepairOrderClientView` содержит `organization_id`/`organization_name`.
- `export_openapi --check`-совместимость: после регенерации `openapi.json` содержит `/api/public/autoservice/organizations` и `/api/autoservice/repair-orders/me/{order_id}/pdf`.

### 6. Регенерация контрактов

- `cd backend && python scripts/export_openapi.py` → `mobile/app/src/api/openapi.json`
- `cd mobile/app && npm run api:types` → `src/api/schema.d.ts`

## Files to Modify

- `backend/app/utils/autoservice_access.py` — хелперы мульти-орг
- `backend/app/schemas/repair_order.py` — org-поля в `RepairOrderClientView`
- `backend/app/routers/autoservice_repair_orders.py` — org-параметр, related_ids, detail по всем orgs, новый PDF-эндпоинт, joinedload organization
- `backend/scripts/export_openapi.py` — префикс `/api/public/autoservice/`
- `backend/tests/test_autoservice_client_contour.py` — новый тест-файл
- `mobile/app/src/api/openapi.json`, `mobile/app/src/api/schema.d.ts` — регенерированные

## Что осознанно НЕ делаем (решения этапа)

- **OTP/новая авторизация** — остаётся email/телефон+пароль (решение пользователя).
- **`user_id` в JWT** — не нужен: `get_current_user` резолвит через email+session; добавление claim ничего не даёт.
- **Пагинация клиентских списков** — списки ограничены одним пользователем (гараж, его заказы/записи); `limit/offset` добавим, если появится реальный объём. Staff-пагинация (этап 1.1) уже есть.
- **Fuzzy-склейка по хвосту телефона** — остаётся «второй очередью» (безопасность); для своих данных используем только `include_phone_matches=False`.
- **Изменение дефолтов** `/garage/vehicles`, `/inspection-bookings/me`, `/clients/me*` — без `organization_id` поведение прежнее (правило «не сломать веб»).
- **`/api/me/*` слой** — существующих `/me`-эндпоинтов достаточно; отдельный слой не строим.

## Verification

- [ ] `cd backend && python -m unittest tests.test_autoservice_client_contour` — новые тесты
- [ ] `python -m unittest tests.test_autoservice_p1 tests.test_autoservice_p2 tests.test_autoservice_access tests.test_autoservice_client_link tests.test_autoservice_inspection_confirm` — регрессия затронутых разделов
- [ ] `python scripts/export_openapi.py --check` — openapi.json актуален
- [ ] `cd mobile/app && npm run api:types && npm run typecheck` — схема сгенерирована, TS чист
- [ ] Ручная проверка на dev: вход клиентом → `GET /autoservice/repair-orders/me` (org-поля в ответе) → `GET /autoservice/repair-orders/me/{id}/pdf` → валидный PDF без закупочных цен
- [ ] Веб-регрессия: `GarageRepairHistoryPage` (`/repair-orders/me?scope=`) и `AutoserviceRepairBookingPage` работают как раньше

## Risks/Considerations

- **Multi-org детали заказа:** `/me/{order_id}` начнёт отдавать заказы всех СТО клиента — это и есть цель, но проверка ownership должна покрывать related ids **всех** orgs, иначе дыра. Тест на чужой заказ обязателен.
- **`organization_id` в `RepairOrderClientView`** — аддитивное поле, веб-клиент его проигнорирует (Pydantic response_model добавит ключ — веб `apiRequest` просто получит лишнее поле, безопасно).
- **PDF под нагрузкой:** рендер идёт через общий semaphore (2–4 слота) — клиентский эндпоинт делит его со staff; отдельный лимит не нужен на этом этапе.
- **Дубли авто в мульти-СТО:** одна и та же машина может быть заведена в garage двух СТО — дедупликация на клиенте (этап 25), бэкенд отдаёт как есть.
- **`require_autoservice_org_id` fallback:** для клиентов `user.organization_id` обычно NULL → всегда `resolve_autoservice_organization_id` (один «главный» СТО). Новые хелперы обязаны идти через `my_active_autoservice_client(db, user, org_id)` с явным org, а не полагаться на fallback.
