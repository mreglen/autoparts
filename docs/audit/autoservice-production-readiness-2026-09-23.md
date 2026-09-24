# Аудит готовности модуля «Автосервис» к продакшену

Дата: 2026-09-23
Ветка: `celery_update` (HEAD `9747ede`)
Область: кабинет автосервиса (backend `app/routers/autoservice_*`, `app/services/autoservice_*`, `repair_order_*`; frontend `src/pages/Autoservice/**`, `src/components/Autoservice/**`), публичная страница и онлайн-запись, доступ/тарифы, инфраструктура в части, влияющей на автосервис.

Метод: чтение кода (backend ~7 000 строк автосервисных роутеров/сервисов, frontend ~15 000 строк), запуск существующих backend- и frontend-тестов, проверка CI и deploy-скриптов. Каждая находка снабжена ссылкой `файл:строки`.

---

## 0. Резюме

**Вердикт: к полноценному запуску «в люди» модуль не готов. Готовность оцениваю в ~65 %.**

Что это значит на практике:

- **Как внутренний инструмент одного автосервиса (текущий режим — один тенант, свои сотрудники)** — работать можно, но с оговорками: есть дыры в безопасности публичных эндпоинтов, а финансовый контур (платежи, зарплата, склад) может рассинхронизироваться при обычных пользовательских сценариях (отмена закрытого заказа, правка закрытого заказа, удаление платежа).
- **Как SaaS-продукт для сторонних автосервисов за 10 000 ₽/мес** — не готов: мультитенантность фактически сломана (всё завязано на «первую» организацию с флагом), биллинга тарифа нет, уведомлений клиентам нет, миграций БД нет, CI не гоняет ни одного автосервисного теста.

Сильные стороны: продуманный UI (эталонные таблицы, автосохранение и черновики заказ-наряда, мобильные карточки почти везде, печатные формы с редактируемыми реквизитами), деньги в `Decimal/Numeric`, сквозная фильтрация по `organization_id` в рабочих эндпоинтах, зрелый deploy-скрипт, rate-limit middleware, legal-страницы (152-ФЗ).

Оценка по блокам:

| Блок | Готовность | Главная проблема |
|---|---|---|
| Доступ и роли | 60 % | `is_seller` обходит все permission-коды; публичные «shortcut»-эндпоинты без авторизации |
| Заказ-наряды | 70 % | Нет машины состояний; правка/оплата закрытых заказов; неатомарная нумерация |
| Платежи и финансы | 55 % | Переплата при гонке; hard delete платежей ломает историю; нет аудита |
| Склад | 75 % | Списания без блокировок; отмена `completed` не возвращает товар |
| Зарплата | 55 % | Начисления не пересчитываются после правок; daily_rate за каждый заказ |
| Планировщик | 60 % | Нет проверки пересечений по постам; TZ-обработка теряет смещение |
| Клиенты / ЛК клиента | 50 % | Захват чужой карточки по телефону; пароль plain-text в письме; нет удаления ПДн |
| Публичная запись | 55 % | Нет капчи/верификации телефона; контент захардкожен под один сервис |
| Frontend кабинет | 85 % | Монолиты 3 000 / 1 150 строк; `window.confirm`; index-as-key в редактируемых списках |
| Печатные формы | 75 % | НДС 22 % захардкожен для всех, без учёта налогового режима |
| Мультитенантность | 30 % | `resolve_autoservice_organization_id()` возвращает первую организацию |
| Тарифы / биллинг | 10 % | Только константа цены и заявка; `paid_until`, оплаты, автопаузы нет |
| Уведомления клиенту | 0 % | SMS/email/push клиенту не реализованы вообще |
| Миграции БД | 20 % | Alembic нет; ~120 DDL-патчей при старте каждого воркера |
| Тесты / CI | 40 % | Автосервисные тесты не в CI; `discover` ломается; 1 модуль красный; e2e нет |
| Мониторинг | 50 % | Нет `/health`, нет трекера ошибок на бэке, бэкапы weekly локально |

---

## 1. Критичные проблемы (блокеры запуска)

### 1.1 Безопасность

| # | Проблема | Где | Почему критично |
|---|---|---|---|
| S1 | **Неавторизованное создание записей на осмотр в любую организацию.** Если пользователь не авторизован, но передал `?organization_id=`, эндпоинт доверяет параметру и создаёт запись с `source="staff"`. Rate-limit на этот путь не настроен (правило есть только для `/api/public/autoservice/inspection-bookings`). | `backend/app/routers/autoservice_inspections.py:367-401`, `backend/app/middleware/rate_limit_middleware.py:28` | Спам в планировщик + рассылка уведомлений всему персоналу на каждую запись |
| S2 | **Неавторизованная выдача расписания дня с ПДн.** `GET /autoservice/planner/shortcuts/today?organization_id=…` без токена отдаёт имена клиентов, марки/модели и госномера. | `backend/app/routers/autoservice_planner.py:229-246` (формирование `_vehicle_label` :36-43, вывод :320-335) | Утечка персональных данных наружу |
| S3 | **Любой `is_seller` получает полный доступ ко всем разделам автосервиса** (финансы, зарплата, клиенты, удаление поступлений) — гранулярные permission-коды работают только для `is_employee`. | `backend/app/utils/autoservice_access.py:44-46, 67-70` | Модель прав фактически не работает для основной роли |
| S4 | **Захват чужой карточки клиента по телефону.** Если телефон в профиле пользователя совпадает с гостевым клиентом (`user_id IS NULL`), карточка молча перепривязывается — пользователь получает историю заказов, записи и авто чужого человека. Более того, привязка происходит с `db.commit()` внутри GET-хелпера. | `backend/app/utils/autoservice_access.py:288-325`, `backend/app/routers/autoservice_clients.py:412-421` | IDOR через подбор телефона; побочная запись в read-запросе |
| S5 | **Пароль аккаунта клиента отправляется открытым текстом в email**, без принудительной смены. | `backend/app/routers/autoservice_clients.py:624-656` | Компрометация почты = компрометация аккаунта |
| S6 | **Правка закрытого/отменённого заказ-наряда.** `update_repair_order` не проверяет статус — можно менять работы, запчасти, цены после оплаты и списания склада. При этом `import_autoservice_stock_to_repair_order` (:1818) и `detach_*` такую проверку делают — поведение несогласованное. | `backend/app/routers/autoservice_repair_orders.py:1612-1703` | Изменение суммы после оплаты; рассинхрон с зарплатой и складом |
| S7 | **Публичная онлайн-запись без антиспама.** Rate-limit 10/15 мин на IP обходится; нет капчи/honeypot, нет валидации `preferred_date` (прошлое/далёкое будущее), телефон не верифицируется, ответ эхом возвращает телефон, `organization_id`, `created_by_user_id`, `notes`. | `backend/app/routers/autoservice_inspections.py:119-149`, `backend/app/schemas/inspection_booking.py:69-87`, `frontend/.../AutoservicePublicPage.jsx:176` | Спам-атака на email/push сотрудников; лишние поля в публичном ответе |

### 1.2 Целостность данных и гонки

| # | Проблема | Где | Последствие |
|---|---|---|---|
| D1 | **Неатомарная нумерация заказ-нарядов**: читает ВСЕ `order_number` организации, max в Python, без блокировки. O(N) на каждый insert. | `backend/app/utils/repair_order_number.py:9-20`; вызов при approve `autoservice_repair_orders.py:1851-1852` | Два параллельных создания → `IntegrityError` → 500, обработки нет |
| D2 | **Неатомарная нумерация платежей** (`MAX()+1`) | `backend/app/services/autoservice_payment_service.py:70-76` | То же |
| D3 | **Неатомарная нумерация документов поступления** | `backend/app/services/autoservice_warehouse_service.py:167-183` | То же |
| D4 | **Переплата при параллельных платежах**: проверка `pay_amount > remaining` не под блокировкой заказа. | `autoservice_payment_service.py:170-175` | Оплачено > итога |
| D5 | **Списание склада без `FOR UPDATE`**: `create_autoservice_expense` читает `available`, потом уменьшает `quantity`; `release_shop_part_reservation`, `reserve_autoservice_item_for_repair` — без блокировки. В модели нет `CHECK quantity >= 0`. | `autoservice_warehouse_service.py:851-869`, `repair_order_stock_reserve.py:18-31, 129-141`, `models/autoservice_warehouse.py:76` | Отрицательные остатки |
| D6 | **Нет машины состояний заказа**: разрешён любой переход (`completed → pending`, `cancelled → completed`…). | `backend/app/schemas/repair_order.py:244-245`, `autoservice_repair_orders.py:1904-1919` | См. D7, D8 |
| D7 | **`completed → cancelled` не возвращает списанный товар**: резервы снимаются только если `prev_status not in ("cancelled","completed")`, а списание уже произошло при `completed`. Обратно `cancelled → completed` повторно начисляет ЗП, но склад не списывает. | `autoservice_repair_orders.py:1904-1919`, возврат только при удалении `repair_order_delete.py:12-47` | Склад «протекает», ЗП дублируется |
| D8 | **`ensure_order_fully_paid` объявлена, но нигде не вызывается** — заказ закрывается с долгом, при этом списывается склад и начисляется ЗП. | `autoservice_payment_service.py:139-145` | Правило «закрыть только после оплаты» декларативно |
| D9 | **Удаление платежа — hard delete** с побочным откатом статуса `completed → done` и **полным стиранием начислений ЗП**, даже если остальные платежи покрывают заказ. | `autoservice_payment_service.py:270-296` | Разрушение кассовой истории и зарплаты |
| D10 | **Удаление заказ-наряда каскадно удаляет платежи** (`payments cascade="all, delete-orphan"`). | `backend/app/models/repair_order.py:145-149` | Для финансового контура недопустимо; нужен soft-delete / сторно |
| D11 | **Платёж «задним числом»**: `paid_at` от клиента подменяет `created_at`, без ограничений и аудита; `update_autoservice_payment_date` свободно переносит платёж между периодами; `PATCH/DELETE /autoservice/finance/receipts/{id}` переписывает/удаляет поступления бесследно. | `autoservice_payment_service.py:31-34, 177-186, 242-267`, `routers/autoservice_finance.py:78-110` | Отчёты меняются задним числом, следов нет |

### 1.3 Архитектура и инфраструктура

| # | Проблема | Где | Последствие |
|---|---|---|---|
| A1 | **Мультитенантность сломана**: `resolve_autoservice_organization_id()` возвращает **первую** организацию с `is_autoservice=True`. На неё завязаны все клиентские эндпоинты (`/autoservice/clients/me`, `/repair-orders/me`), публичная страница, дайджест. Контент публичной страницы захардкожен («Свой гараж на Фруктовая 17, Екатеринбург»). | `backend/app/utils/org_access.py:44-57`, `autoservice_clients.py:368`, `frontend/.../utils/autoserviceConstants.js:2-5` | При подключении второго автосервиса клиенты попадут не туда, публичная страница будет врать |
| A2 | **Нет Alembic.** Схема меняется через `Base.metadata.create_all` + ~120 идемпотентных `ensure_*`-патчей (`schema_patches.py`, ~6 400 строк) при импорте `main.py` — т.е. **в каждом gunicorn-воркере при каждом старте**. Ошибка любого патча = приложение не поднимается. Backfill и seed тоже на старте. (AGENTS.md упоминает Alembic ошибочно — каталога нет.) | `backend/app/main.py:227-394`, `backend/app/db/schema_patches.py` | Гонки DDL, блокировки на проде, нет версионирования и отката |
| A3 | **Тариф 10 000 ₽/мес не реализован**: только константа `TARIFF_PRICE_RUB` и заявка. Нет `paid_until`, оплат, автопаузы; «истечение» — ручной `pause/disable` админом. | `backend/app/routers/autoservice_applications.py:24, 60`, `admin.py:1509-1660`, `models/organization.py:28-29` | Монетизация заявлена, но не работает |
| A4 | **CI не запускает ни одного автосервисного теста**: список из 38 модулей жёстко задан, `test_autoservice_*` и `test_repair_order_*` в нём нет. Триггер только `main/master`, ветка `celery_update` не покрыта. | `.github/workflows/ci.yml:30-68` | Регрессии автосервиса CI не ловит |

---

## 2. Важные проблемы (исправить до/сразу после запуска)

### 2.1 Backend: заказ-наряды и склад

- **Клиентские цены принимаются на веру.** `unit_price`, `markup_percent`, `client_unit_price_override` берутся из запроса для `manual`/`warehouse`/`rossko`; при PATCH цену `autoservice_stock`-позиции тоже можно перезаписать. Permission `autoservice.markup` существует, но здесь не проверяется. — `schemas/repair_order.py:91-106`, `autoservice_repair_orders.py:1071-1077, 1211, 1225-1231`.
- **Три разные формулы цены с наценкой** (ceil / floor / half-up) в трёх местах: роутер `_price_with_markup` (:146-148, `ROUND_CEILING`), `autoservice_warehouse_service.py:1011-1013` (floor), `autoservice_order_economics.py:52`. Цена в заказ-наряде и в отчёте «Экономика» могут разойтись на рубль.
- **Сумма процентов исполнителей не проверяется** — каждый ≤100, но трое по 100 % = 300 % ЗП от строки. — `schemas/repair_order.py:66`, `autoservice_repair_orders.py:890-966`.
- **`status_*_at` перезатираются** при повторных переходах; `scheduled_end_at` перезаписывается фактическим временем, портя плановую дату. — `repair_order_status_timestamps.py:27-36`.
- **Резерв/списание дробных единиц (`l`/`kg`) округляется до целых** через `_qty_int` — при qty=0.5 кг резервируется 1. — `repair_order_stock_reserve.py:14-15`, `autoservice_warehouse_service.py:832`.
- **Редактирование строки поступления переписывает shared `AutoserviceWarehouseItem`** (brand/article/name/price), на который ссылаются другие приходы и заказы. — `autoservice_warehouse_service.py:1482-1487, 1750-1754`.
- **`_restore_completed_order_stock` ищет расходы по тексту `reason`** `f"Заказ-наряд №{…}"`, а не по `repair_order_id`; в movements есть fallback-парсинг той же строки — признак незаконченной миграции. — `repair_order_delete.py:19-26`, `autoservice_warehouse.py:469-492, 999-1015`.
- **Нет idempotency-key** — двойной submit создания заказа создаёт два заказа.
- **Позиция с неизвестным `id` молча создаётся как новая** вместо 400. — `autoservice_repair_orders.py:1105-1117`.
- **Несогласованная транзакционная модель**: сервис возвратов коммитит внутри себя (`autoservice_warehouse_return_service.py:334, 469`), остальные — в роутере.
- **`delete_garage_vehicle` не проверяет связанные заказы** → `IntegrityError` → 500. — `autoservice_garage.py:373-385`.

### 2.2 Backend: планировщик, зарплата, клиенты

- **Нет проверки пересечений записей по времени и посту** — двойной букинг одной зоны гарантированно возможен; проверяется только `end > start`. — `autoservice_repair_orders.py:1560-1577, 1652-1674`, `autoservice_work_zone_helpers.py:83-96`.
- **Часовые пояса**: конвенция «naive = MSK», но `normalize_dt` делает `replace(tzinfo=None)` — tz-aware время от клиента **теряет смещение вместо конвертации**. Повсюду `datetime.utcnow()` / `date.today()` / `datetime.now()` в серверной TZ. — `autoservice_work_zone_helpers.py:75-80`, `autoservice_notifications.py:101-105`, `autoservice_repair_orders.py:1546`, `autoservice_payment_service.py:31-34`.
- **Начисления ЗП пересчитываются только при переходе в `completed`** — правка работ/исполнителей/цен закрытого заказа их не трогает. — `autoservice_repair_orders.py:1911-1913, 1679-1691`.
- **`daily_rate` начисляется за каждый заказ**, а не за день. — `autoservice_payroll.py:44-97`.
- **Нет слияния дубликатов клиентов**; вместо этого костыль `related_autoservice_client_ids` выгружает все телефоны организации в Python и сравнивает хвосты — O(таблица) на каждый вызов. — `autoservice_access.py:249-285`.
- **Несогласованная видимость для клиента с дубли-карточками**: `list_my_repair_orders` фильтрует строго по `client_id`, а записи — по `related_ids`. — `autoservice_repair_orders.py:1406`, `autoservice_inspections.py:161-170`.
- **Согласие на ПДн фиктивное**: `consented_at` проставляется автоматически при создании клиента сотрудником. **Удаления/анонимизации клиента нет вообще** (152-ФЗ). — `autoservice_clients.py:429-438, 498-507`.
- **`update_garage_vehicle`/`delete_garage_vehicle` фильтруют только по `client_id`**, без `organization_id` — работает только благодаря порядку проверок. — `autoservice_garage.py:56-69`.
- **Deprecated-слой `/autoservice/repair-bookings/*`** дублирует логику `InspectionBooking`, `staff_notes` сливается в `notes`. — `autoservice_repair_bookings.py` (весь файл), :303-307.

### 2.3 Backend: производительность

- **Пагинации нет нигде**: заказ-наряды (`.all()` :1489, `/me` :1411), клиенты (`autoservice_clients.py:463-466`), записи (`autoservice_inspections.py:261`), поступления, возвраты, admin-список заявок (`admin.py:1465-1469`). Складские списки — жёсткие `limit(200/400/500)` без offset («тихая» потеря данных). — `autoservice_warehouse.py:378, 658, 688, 995`.
- **N+1 в `_shop_part_view`**: на каждую запчасть 3–4 отдельных запроса (`shop_part_is_in_cart`, `manual_receipt_for_shop_part` ×2, `shop_part_stock_max_qty`). Для 100 заказов × 5 позиций ≈ 2 000 запросов на один список. — `autoservice_repair_orders.py:265-322`.
- **N+1 в клиентах**: запрос `User` на каждого клиента + `_find_matching_vehicle` на строку при поиске. — `autoservice_clients.py:136-143, 195-210, 469-470`.
- **Поиск `ilike '%…%'` по десятку полей и подзапросам** — последовательные сканы. — `autoservice_clients.py:240-359`.
- **Индексов нет** на `repair_orders.status` (`repair_order.py:85`), `scheduled_at`, `created_at`; на `repair_order_shop_parts.cart_item_type/cart_item_id` (:276-277); на `inspection_bookings.phone`; на `autoservice_warehouse_expenses.created_at`. Составного `(organization_id, status, scheduled_at)` нет.
- `get_autoservice_staff_recipient_user_ids` грузит всех пользователей организации в память. — `autoservice_notifications.py:58`.

### 2.4 Backend: валидация

- Нет верхних границ: `qty` работ (`ge=1` без `le`), `qty` запчастей, `unit_price`, `markup_percent` в `RepairOrderShopPartIn` (при импортах есть `le=500` — несогласованно). Списки `works`/`client_parts`/`shop_parts` без `max_length` → DoS через 100 000 позиций.
- `item_price_overrides: dict[int, Decimal]` — ключи не сверяются с `item_ids`. — `schemas/repair_order.py:123`.
- `photo_urls: list[str]` — без валидации формата URL. — `schemas/autoservice_warehouse.py:265`.
- `AutoservicePayment.method` — строка без CHECK; неизвестные методы молча мапятся в `cash` при отображении. — `autoservice_payment_service.py:53, 107, 229`.
- `paid_at`/`preferred_date` принимают любую дату (прошлое, далёкое будущее).

### 2.5 Frontend

- **Монолиты**: `AutoserviceOrderFormPage.jsx` — 3 006 строк (десяток внутренних компонентов), `RepairOrderViewModal.jsx` — 1 152 строки (просмотр + оплата + история + статусы), `AutoserviceReportsPage.jsx` — 1 604, `AutoserviceClientsPage.jsx` — 1 479.
- **`window.confirm` для деструктивных/юридически значимых действий**: удаление рабочей зоны (`AutoserviceSettingsPage.jsx:359`), «стать клиентом» (`AutoservicePublicPage.jsx:133`, `AutoserviceWelcomePage.jsx:49`). Везде остальное — `ConfirmDialog`.
- **index-as-key в редактируемых списках**: работы (`AutoserviceOrderFormPage.jsx:2590`), запчасти клиента (:2667), `RepairOrderViewModal.jsx:937, 951` — при удалении средней строки controlled-инпуты «съезжают».
- **Нет `beforeunload` при `autoSaveStatus === 'error'`** — при упавшем автосохранении уход со страницы теряет правки молча. — `AutoserviceOrderFormPage.jsx:2229-2289`.
- **Гонки setState после unmount** в `loadMeta`/`loadOrder` (только один эффект использует `cancelled`). — `AutoserviceOrderFormPage.jsx:1302-1337, 1455`.
- **Тихое проглатывание ошибок**: `catch { setVehicles([]) }` (`AutoserviceRepairBookingPage.jsx:189-190`), `catch { setIsClient(false) }` (`AutoservicePublicPage.jsx:120`).
- **`/autoservice/repair-booking`: телефон без маски и валидации** (на публичной странице есть `PhoneInput` + `validatePhone`), время записи не вводится. — `AutoserviceRepairBookingPage.jsx:283-292`.
- **Дублирование форматтеров**: локальный `formatMoney` минимум в 6 файлах, `formatDate`/`formatDateTime` в 6+; часть через `formatServerDate`, часть — ручной `slice(0,10).split('-')` (риск TZ-багов). — `RepairBookingPage:49-54`, `WarehouseExpensesPage:35`, `WarehouseReceiptsPage:37`, `RepairOrderPickerModal.jsx:19`.
- **Дублирование расчёта итогов фронт/бэк**: `lineSum` локально в `RepairOrderPrintPage.jsx:87-91`, `RepairOrderUpdPrintPage.jsx:120`, форме :1586-1600 + fallback `order.grand_total ?? worksTotal + shopTotal` — при расхождении разные суммы на экране и в печати.
- **Мобильная навигация**: `MobileBottomNav` содержит только пункты магазина, ни одного для автосервиса — сотрудник идёт через бургер профиля. — `components/MobileBottomNav/MobileBottomNav.jsx:12+`.
- **`AutoserviceStaffRoute` — if-chain на 140 строк** по section вместо таблицы роутов. — `App.js:310-452`. Мёртвый `AUTOSERVICE_STAFF_TABS` (`App.js:299-308`).
- **Банковские реквизиты счёта хранятся только в `localStorage`** (`autoservice-invoice-bank:<orgId>`) — не синхронизируются между устройствами, теряются при чистке. — `RepairOrderInvoicePrintPage.jsx:88-114`.

### 2.6 Печатные формы

- **`UPD_VAT_RATE = 22` захардкожен** и применяется «в т.ч. НДС» ко всем суммам без учёта налогового режима организации (УСН/ОСНО). У организации нет признака режима ни на бэке, ни на фронте. — `frontend/.../utils/updDocument.js:1`. На бэке НДС отсутствует полностью — документы и учёт расходятся.
- ИНН/адрес исполнителя **не входят** в `REQUIRED_FIELDS` заказ-наряда — при незаполненных настройках организации документ печатается неполным без предупреждения. — `RepairOrderPrintPage.jsx:52-58, 223-226`.
- Редактор реквизитов клиента на печати молча мутирует справочник клиентов (`saveAutoserviceClientRequisites`).

### 2.7 Тесты и качество

- **Backend-тесты автосервиса не запускаются единым прогоном**: `python -m unittest discover -s tests -p "test_autoservice_*.py"` → 21 ошибка (`Mapper[YookassaPayment] … failed to locate a name 'NewPartsCheckoutSession'`) из-за порядка импорта моделей. По одному модулю — проходят. Это же делает невозможным добавление их в CI без починки.
- **Красный тест в репозитории**: `tests/test_autoservice_warehouse_receipt_view.py` — 2 ошибки, `decimal.InvalidOperation` в `_money` (`autoservice_warehouse.py:78`) через `_receipt_line_view` (:122). Тест устарел после изменений кода или код сломан — требует разбора.
- **Тесты — моки без БД/HTTP** (`MagicMock` db, patch хелперов): SQL, ограничения БД, реальные эндпоинты не проверяются.
- **Не покрыты тестами роутеры**: planner, inspections, clients, repair_bookings, service_employees, settings, document_buyers, my_payroll, applications (жизненный цикл заявки), finance (только общие).
- **Frontend**: 5 тестов на 22 страницы (фокус `SearchableSelect`, предзаполнение `AddClientModal`, видимость вкладки Rossko). Нет тестов автосохранения, валидации, расчёта итогов, печати. Playwright e2e — только магазин, автосервис не покрыт.
- **Git-гигиена**: 8 из последних 15 коммитов — «фывфыв», «щоозш», «;jljk», «dfg», «poojok». История непригодна для `git bisect`/blame и ревью.

### 2.8 Инфраструктура и эксплуатация

- **Нет выделенного `/health`** — health-check дергает `/api/auth/public-site-config` (зависит от БД и site_settings). — `scripts/deploy/update.sh:16`.
- **Нет трекера ошибок на бэке** (Sentry только на фронте в `ErrorBoundary`). Логирование — `logging.basicConfig(INFO)`, неструктурированное. — `main.py:212`.
- **Бэкапы только weekly, локально** (`backend/backups`), без off-site копии и daily. — `main.py:555-561, 775-782`, `services/backup_service.py`.
- **Расписание дайджестов живёт в APScheduler внутри gunicorn-лидера**, а не в Celery beat (beat почти пуст). — `main.py:562-568`, `celery_app.py:58-65`.
- Backfill `organization_employee_cards`, `_ensure_default_permissions`, seed landing pages — при каждом старте. — `main.py:309-321, 384-394`.

---

## 3. Чего нет вообще (сравнение с типичной CRM автосервиса)

| Функция | Статус | Комментарий |
|---|---|---|
| Уведомления **клиенту** (подтверждение записи, напоминание за сутки, «авто готово», «заказ закрыт») | **Нет** | Ни SMS, ни email, ни push. SMS-канала в проекте нет (grep `sms` → только legal-тексты). Персоналу — есть (email + push + дайджест) |
| Верификация телефона клиента | **Нет** | Из-за этого S4, S7 |
| Биллинг тарифа автосервиса | **Нет** | Только заявка и константа 10 000 ₽ |
| Мультитенантная публичная страница (`/autoservice/<slug>`) | **Нет** | Одна захардкоженная страница |
| Машина состояний заказ-наряда | **Нет** | Любой переход разрешён |
| Сторно / возврат платежа | **Нет** | Только hard delete |
| Кассовые смены, расходные операции кассы | **Нет** | Метод оплаты — строка |
| Онлайн-касса / 54-ФЗ (чеки клиенту) | **Нет** | Есть только печатная «квитанция» |
| Учёт НДС / налоговый режим организации | **Нет** | На фронте НДС 22 % всем |
| Акт выполненных работ как отдельный документ | **Нет** | Есть заказ-наряд, счёт, УПД, квитанция |
| Гарантия на работы / запчасти | **Нет** | |
| История обслуживания авто как витрина | Частично | Заказы по `vehicle_id` есть, отдельного экрана/рекомендаций по ТО нет |
| Напоминания о ТО по пробегу/дате | **Нет** | `mileage_km` хранится, не используется |
| Слияние дубликатов клиентов | **Нет** | Костыль по хвосту телефона |
| Удаление / анонимизация клиента (152-ФЗ) | **Нет** | Согласие ставится автоматически |
| Журнал изменений заказа/платежей (кто, когда, что) | **Нет** | Только `created_by`, `updated_at`, `status_*_at` (перезатираются) |
| Проверка занятости постов при записи | **Нет** | Двойной букинг возможен |
| Роли «мастер / приёмщик / менеджер» как сущности | **Нет** | Плоские флаги + 10 permission-кодов; `position` — свободный текст |
| Пагинация списков | **Нет** | Везде `.all()` или жёсткий `limit` |
| Alembic-миграции | **Нет** | |
| E2E-тесты автосервиса | **Нет** | |
| Пользовательская документация / онбординг автосервиса | **Нет** | `docs/` — только ops/SEO/laximo |
| Экспорт XLSX (финансы, ЗП, склад, экономика, Rossko) | Есть | |
| Возвраты поставщику | Есть | Самый зрелый кусок: таблица переходов, `FOR UPDATE`, 409 на дубль |
| Печать заказ-наряда / счёта / УПД / квитанции + PDF | Есть | |
| Legal-страницы, согласия, cookie-баннер | Есть | |

---

## 4. Что сделано неправильно концептуально (переделать)

1. **Финансовые записи удаляются физически.** Платежи, поступления, заказ-наряды — hard delete с каскадами. В учёте так нельзя: нужны soft-delete + сторно-записи, а удаление — только для черновиков.
2. **Статусы — просто строка без переходов.** Побочные эффекты (списание склада, начисление ЗП, снятие резервов) привязаны к отдельным `if prev_status …` в одном роутере и не инвертируются при обратных переходах. Нужна явная таблица переходов с парами «действие / компенсация», как уже сделано для возвратов (`RETURN_TRANSITIONS`).
3. **Нумерация документов через `MAX()+1` в Python.** Нужна таблица-счётчик по организации с `SELECT … FOR UPDATE` или PostgreSQL-sequence на организацию.
4. **Схема БД меняется при старте приложения.** `schema_patches.py` на 6 400 строк — это неверсионируемый Alembic, выполняемый в каждом воркере. Нужно заморозить патчи, внедрить Alembic, запускать миграции один раз в `update.sh` до рестарта.
5. **«Автосервис» = «первая организация с флагом».** Все клиентские и публичные пути должны получать организацию из URL (`/autoservice/<slug>`) или из связи «клиент ↔ организация», а не из глобального резолвера.
6. **`is_seller` ≡ полный доступ.** Обход permission-кодов для главной рабочей роли обнуляет систему прав. Права должны выдаваться явно; директор — единственный bypass.
7. **Привязка ЛК клиента по совпадению телефона без подтверждения** — нужен OTP по SMS/звонку.
8. **Расчёт цены с наценкой в трёх местах с разным округлением.** Одна функция в одном модуле, фронт использует только серверные `grand_total`/`line_total`.
9. **НДС на фронте, отсутствие НДС на бэке.** Признак налогового режима и ставки — в настройках организации на сервере, документы и отчёты — из одного источника.
10. **`paid_at` подменяет `created_at`.** Должно быть два поля: дата операции (редактируемая, с журналом) и время создания записи (неизменяемое).

---

## 5. Желательные улучшения

- Вынести `_money/_qty/_line_sum/_price_with_markup` и `_apply_search_filter`, `_reindex_*` в один модуль (сейчас копии в 3–4 файлах).
- Удалить мёртвый код: `sync_order_reservations` (`repair_order_stock_reserve.py:83-95`), `ensure_order_fully_paid` (или начать вызывать), идентичные ветки в `repair_order_purchase_import.py:234-239`, `_match_accrual_to_order_work` (`autoservice_payroll.py:190-206`), `AUTOSERVICE_STAFF_TABS`.
- `SHOP_PART_UNITS` есть, но литералы `pcs/l/kg` размазаны по 10+ местам.
- `updated_at` на позициях заказа и платежах.
- `aria-invalid`/`aria-describedby` на полях с ошибками; один `ErrorBoundary` на всё приложение — падение чанка автосервиса роняет весь UI.
- Публичная страница использует иную палитру (indigo/blue, `rounded-xl`) — кабинет на `brand-*`/`rounded-sg*`.
- Опечатка: таб «Мои запись» (`AutoserviceRepairBookingPage.jsx:433`).
- Третья таблица в `AutoserviceReportsPage.jsx:1071` без `autoserviceListTableWrapClass`.
- Composite-индексы `(organization_id, status, scheduled_at)`; индекс на `inspection_bookings.phone`.
- Daily-бэкапы + выгрузка off-site; `/health`; Sentry на бэке; структурированные логи.
- Прогнать gitleaks по истории (в текущем коде секретов не найдено, но мусорные коммиты могли что-то затащить ранее).
- Обновить AGENTS.md: убрать упоминание Alembic либо внедрить его.

---

## 6. Что сделано хорошо

- Сквозная фильтрация `organization_id` в рабочих (авторизованных) эндпоинтах; централизованные хелперы `require_autoservice_*`; уровень `own` для мастеров (`_own_orders_visibility_clause`).
- Клиентские вью (`*ClientView`) скрывают закупочные цены и наценку.
- Деньги — `Numeric(12,2)` + `Decimal`, float в БД нет.
- Возвраты поставщику — эталонная реализация (переходы, блокировки, резерв, 409).
- `delete_receipt_document` / `update_receipt_line_details` — защита от ухода ниже резервов.
- Pydantic-схемы на всех входах, `Literal` для enum, `model_fields_set` для PATCH; `q`/`status`/`scope` — whitelist и `max_length`.
- Frontend: автосохранение + черновики в localStorage с флашем на `pagehide`; `ConfirmDialog` почти везде; `saving`-флаги против двойного сабмита; все 22 страницы `lazy()`; html2canvas/jsPDF — динамический импорт; `apiClient.js` с retry/refresh/таймаутами; 152 `useMemo/useCallback`; мобильные карточки на большинстве страниц; полное соответствие эталону таблиц `warehouseListUi.js`; нет `console.log`/TODO в разделе.
- Печатные формы: обязательные поля блокируют печать, сумма прописью, редактируемые поля с подсветкой правок, УПД с полным набором граф.
- Дайджест планировщика идемпотентен (`autoservice_digest_log`), leader-lock через Redis.
- Deploy `update.sh`: lock, rollback по SHA, health-wait, проверка API URL в сборке, мониторинг через cron + Telegram.
- Rate-limit middleware на Redis; API docs отключаемы; CORS из env; `.gitignore` корректен; legal-страницы и согласия есть.

---

## 7. План выхода в продакшен (порядок работ)

### Этап 0 — блокеры безопасности (1–2 дня)
1. Убрать неавторизованные ветки в `shortcut`-эндпоинтах (S1, S2) или закрыть их секретным токеном + rate-limit.
2. Убрать `is_seller` из bypass в `has_autoservice_permission` / `require_any_autoservice_permission` (S3); выдать продавцам нужные permission-коды явно.
3. Отключить автопривязку карточки клиента по телефону до появления OTP (S4); убрать `db.commit()` из хелпера.
4. Пароль клиенту — одноразовая ссылка установки пароля вместо plain-text (S5).
5. Запрет `update_repair_order` и `create_payment` для `completed`/`cancelled` (S6).
6. Капча/honeypot + серверная валидация `preferred_date`, урезать поля публичного ответа (S7).

### Этап 1 — целостность финансов и склада (1–2 недели)
7. Таблица переходов статусов + компенсирующие действия (возврат склада при отмене `completed`, пересчёт ЗП при reopen) (D6, D7).
8. Вызывать `ensure_order_fully_paid` при `→ completed` (D8) или явно принять «закрытие с долгом» и отразить в UI.
9. Атомарная нумерация заказов/платежей/документов через таблицу-счётчик + `FOR UPDATE` (D1–D3); обработка `IntegrityError` → 409.
10. `SELECT … FOR UPDATE` во всех операциях с `quantity`/`reserved_qty`/`remaining` (D4, D5); `CHECK quantity >= 0`.
11. Soft-delete(не удалять запись а помечать запись как удалённую, на будущее будем через администраторов возвращать) + сторно для платежей и поступлений; запрет удаления заказа с платежами (D9–D11); журнал изменений (кто/когда/что) для заказов, платежей, поступлений.
12. Пересчёт ЗП при правке работ; `daily_rate` — один раз в день; сумма процентов исполнителей ≤ 100.
13. Одна функция цены с наценкой; НДС/налоговый режим — в настройках организации.

### Этап 2 — эксплуатационная готовность (1 неделя)
14. Alembic: autogenerate от текущей схемы как baseline, заморозить `schema_patches`, миграции — шаг в `update.sh` до рестарта.
15. Починить `unittest discover` (порядок импорта моделей), починить `test_autoservice_warehouse_receipt_view`, добавить все `test_autoservice_*`/`test_repair_order_*` в CI, включить триггер на рабочую ветку.
16. `/health`, Sentry на бэке, daily-бэкап + off-site.
17. Пагинация списков заказов/клиентов/записей; устранить N+1 в `_shop_part_view` и клиентах; индексы.

### Этап 3 — продуктовая полнота для SaaS (2–4 недели)
18. Мультитенантность: организация из URL/связи, публичная страница по slug, настройки контента в `AutoserviceSettings`.
19. Уведомления клиенту (подтверждение, напоминание, готовность) — минимум email + push, SMS-провайдер.
20. Проверка пересечений постов в планировщике; нормальная TZ-обработка (tz-aware в БД или явная конвертация).
21. Биллинг тарифа: `paid_until`, оплата через YooKassa (уже интегрирована для магазина), job автопаузы.
22. Удаление/анонимизация клиента, реальное согласие на ПДн.
23. Frontend: разбить `AutoserviceOrderFormPage` и `RepairOrderViewModal`, заменить `window.confirm`, стабильные ключи, общие форматтеры, пункты автосервиса в `MobileBottomNav`, e2e Playwright на ключевые сценарии (создать заказ → оплатить → закрыть → печать).

### Этап 4 — гигиена
24. Осмысленные commit-сообщения; gitleaks по истории; актуализация AGENTS.md; пользовательская документация автосервиса.

---

## Приложение А. Результаты запуска тестов (2026-09-23)

```text
backend: python -m unittest tests.test_autoservice_<module>   (по одному)
  access, notifications, order_economics, payments, payroll_report,
  reports_xlsx, rossko_sales_economics, rossko_sales_report,
  warehouse_item_reservations, warehouse_item_update,
  warehouse_receipt_delete, warehouse_returns, warehouse_stock_report,
  warehouse_supplier, work_zones                      => OK
  warehouse_receipt_view                              => FAILED (errors=2)
      decimal.InvalidOperation в autoservice_warehouse.py:78 (_money)
      через _receipt_line_view :122

backend: python -m unittest discover -s tests -p "test_autoservice_*.py"
  Ran 89 tests, FAILED (errors=21)
      sqlalchemy InvalidRequestError: Mapper[YookassaPayment] failed to
      locate 'NewPartsCheckoutSession' — порядок импорта моделей

backend: python -m unittest discover -s tests -p "test_repair_order_*.py"
  Ran 34 tests, OK

frontend: react-scripts test src/pages/Autoservice
  2 suites, 5 tests, PASS (с act()-предупреждениями в AutoserviceReportsPage)
```

## Приложение Б. Ключевые файлы

- `backend/app/routers/autoservice_repair_orders.py` (~1 960 строк)
- `backend/app/routers/autoservice_warehouse.py` (~1 190)
- `backend/app/services/autoservice_payment_service.py`
- `backend/app/services/autoservice_payroll.py`
- `backend/app/services/repair_order_stock_reserve.py`
- `backend/app/utils/autoservice_access.py`, `org_access.py`, `repair_order_number.py`
- `backend/app/db/schema_patches.py` (~6 400)
- `frontend/my-autoparts/src/pages/Autoservice/AutoserviceOrderFormPage.jsx` (3 006)
- `frontend/my-autoparts/src/components/Autoservice/RepairOrderViewModal.jsx` (1 152)
- `frontend/my-autoparts/src/utils/updDocument.js`, `autoserviceConstants.js`
- `.github/workflows/ci.yml`, `scripts/deploy/update.sh`
