# Laximo.CAT — поэтапный план для Plan mode

Документ для чата Cursor: прикрепляй этот файл и пиши **«сделай план для этапа N»** (или копируй промпт из § «Как запускать»).

Основано на: [laximo-cat-vin-capabilities.md](./laximo-cat-vin-capabilities.md).  
Детали API/REST: [laximo-cat-integration-plan.md](./laximo-cat-integration-plan.md).

**Стек:** REST РФ `https://ws.laximo.ru/restApi/v1`, HTTPS POST, Basic Auth, `accept-language: ru_RU`.  
**Не использовать:** SOAP `FindVehicleByVIN` — для REST брать `FindVehicle`.

**Ключи:** только через `/admin-settings` (как OpenRouter). Продуктовая логика Laximo **не работает**, пока админ не сохранил credentials, не прошёл успешный тест API и не включил тумблер (и пока не исчерпана месячная квота в 1000 запросов).  
**Пользователю** при любых техсбоях/квоте — одна мягкая формулировка «сервис временно недоступен», без раскрытия причины.

---

## Как запускать

1. Прикрепи к чату: `@docs/laximo-stages-plan.md` (этот файл).
2. По желанию: `@docs/laximo-cat-vin-capabilities.md`.
3. Переключись в **Plan mode**.
4. Напиши одну из фраз:

```
Сделай план для этапа 0 по @docs/laximo-stages-plan.md
```

```
Сделай план для этапа 1 по @docs/laximo-stages-plan.md
```

…и так далее до этапа 5.

После утверждения плана в Plan mode — попроси агента **реализовать утверждённый план** (Agent mode).

**Правила для агента на любом этапе:**

- Делать **только** scope этапа N; не забегать в N+1.
- Сначала прочитать § этапа N **и** § «Гейт /admin-settings» в этом файле.
- Учитывать зависимости: предыдущие этапы должны быть сделаны (или явно сказали «пропустить»).
- Секреты Laximo только на бэкенде (шифр в БД); на фронт — лишь маски/`*_configured` / статус теста.
- Любой публичный/продуктовый вызов CAT обязан проверять `laximo_cat_ready()` (см. ниже). Если не ready / квота / upstream fail — **публичный** soft-fail `temporarily_unavailable`, не 500 и не техдетали.
- Обычному пользователю не светить: квоту, Laximo, ключи, подписку. Админу в `/admin-settings` — полная картина.
- Не коммитить без явной просьбы.

---

## Гейт /admin-settings (сквозное требование)

Образец в репо: OpenRouter на `/admin-settings` (`OpenRouterSection.jsx`, `/admin/openrouter/*`) — сохранить ключ → тест → `is_enabled`.

### Поведение продукта

| Внутреннее состояние (только бэкенд/админ) | Публичный `reason` для UI | Что видит обычный пользователь |
|--------------------------------------------|---------------------------|--------------------------------|
| Нет логина/пароля | `temporarily_unavailable`* | Мягкий баннер «сервис временно недоступен» + ручной ввод |
| Ключи есть, тест не пройден / упал | `temporarily_unavailable`* | то же |
| `is_enabled=false` | `temporarily_unavailable`* | то же |
| Квота запросов исчерпана | `temporarily_unavailable` | то же — **без слова «лимит» / «API» / «Laximo»** |
| Ошибка upstream (401/403/subscription/5xx/timeout) | `temporarily_unavailable` | то же |
| VIN не найден в каталоге | `not_found` | «Автомобиль не найден» + ручной ввод (это ок раскрывать) |
| Всё OK | — | нормальный флоу |

\* Для админских/внутренних логов хранить точный код (`not_configured`, `not_verified`, `disabled`, `quota_exhausted`, `upstream_error`).  
В JSON **клиенту** (не-админ) отдавать только безопасные reason: `temporarily_unavailable` | `not_found` | `ok` (+ candidates).

**Жёсткое правило UX:** пользователь **никогда** не должен узнать, что «закончились запросы», «подписка», «ключ», «Laximo». Формулировка одна на все технические сбои.

### Данные (предложение)

Таблица вроде `site_laximo_cat_integration` (singleton `id=1`), по аналогии с OpenRouter:

| Поле | Назначение |
|------|------------|
| `login_encrypted` / `password_encrypted` | Basic Auth (не отдавать на фронт) |
| `base_url` | По умолчанию `https://ws.laximo.ru/restApi/v1`, редактируемо админом |
| `is_enabled` | Ручной тумблер «включить интеграцию» |
| `last_test_ok` | Результат последней проверки |
| `last_tested_at` | Когда тестировали |
| `last_test_error` | Текст ошибки **для админа** (без пароля) |
| `last_test_catalogs_count` | Сколько каталогов вернул `ListCatalogs` |
| `daily_request_limit` | Лимит запросов к CAT в сутки (задаёт админ; 0 = без лимита — осторожно) |
| `requests_today` | Счётчик успешных/учтённых вызовов за текущие сутки |
| `requests_day` | Дата сброса счётчика (`YYYY-MM-DD`, timezone сайта) |
| `quota_exhausted_at` | Когда упёрлись в лимит (для админ-алерта) |
| `last_upstream_error_at` / `last_upstream_error` | Последний сбой Laximo (админ) |

Опционально позже: `monthly_request_limit` / `requests_month` — если тариф месячный.

Хелперы бэкенда:

```text
laximo_cat_ready(db) ==
  credentials_configured
  AND last_test_ok == true
  AND is_enabled == true
  AND not quota_exhausted(db)   # requests_today < daily_request_limit (если limit > 0)

map_to_public_reason(internal) →
  not_found → not_found
  всё остальное техническое → temporarily_unavailable
```

Каждый реальный HTTP-вызов к CAT (кроме админского `test`, по политике):  
`increment_laximo_request_counter()` **после** (или перед — зафиксировать в реализации) вызова; при `requests_today >= limit` → не ходить в сеть, сразу `temporarily_unavailable`.

`cat_client` читает credentials **из БД**. Env `LAXIMO_CAT_*` — только опциональный dev-fallback.

### UI на `/admin-settings`

Секция **«Laximo.CAT»** (как `OpenRouterSection`):

1. Поля: логин, пароль (пустое = не менять), base URL.
2. Кнопка **Сохранить** → `POST /admin/laximo-cat/credentials`.
3. Кнопка **Проверить API** → `POST /admin/laximo-cat/test` → `ListCatalogs`.
4. Тумблер **Включить** — только если `last_test_ok`.
5. Блок **квоты** (видно только админу):
   - поле «Лимит запросов в сутки»
   - прогресс: «Использовано N из M» / «Осталось K»
   - pill: `OK` / `Мало осталось` (например &lt; 10%) / `Лимит исчерпан`
   - кнопка «Сбросить счётчик сегодня» (с confirm) — на случай ручной коррекции
6. Статус-pill интеграции: `Не настроено` / `Не проверено` / `Ошибка` / `Лимит` / `Отключено` / `Подключено`.
7. Пароль на фронт не отдавать; только `password_configured`.

При исчерпании квоты или серии upstream-ошибок — **заметный алерт в этой же секции** (для админа можно писать правду: «дневной лимит запросов исчерпан»).

### Пользовательские оповещения (стилистика сайта)

Не изобретать отдельный «AI-toast». Вписаться в текущий UI: `rounded-xl`, `border`, `bg-white` / мягкий нейтральный или amber фон — как карточки гаража / заказов (`GaragePage`, `GarageOrdersPage`).

Рекомендуемый общий компонент, например `SoftServiceNotice.jsx`:

- спокойный тон, без красной «аварии» и без технических деталей;
- иконка (простая outline), заголовок + одна фраза + опционально «Попробовать снова» / продолжить вручную;
- mobile-friendly, без модалок на весь экран для штатного сбоя.

**Тексты (публичные, фиксированные):**

| Случай | Заголовок | Текст |
|--------|-----------|--------|
| Любой техсбой / квота / выключено | Сервис временно недоступен | Простите, сейчас поиск автомобиля по VIN временно не работает. Попробуйте позже или заполните данные вручную. |
| VIN не найден | Автомобиль не найден | Не удалось определить автомобиль по этому VIN. Проверьте номер или заполните поля вручную. |

Запрещённые слова в пользовательском UI/API message: `Laximo`, `API`, `квота`, `лимит запросов`, `подписка`, `ключ`, `401`, `E_ACCESSDENIED`.

Для поиска (этап 4): тот же баннер над выдачей; не показывать пустой «сломанный» каталог узлов.

### Admin API (этап 0)

```
GET  /admin/laximo-cat/integration
POST /admin/laximo-cat/credentials
PATCH /admin/laximo-cat/settings          # is_enabled, base_url, daily_request_limit
POST /admin/laximo-cat/test              # ListCatalogs smoke
POST /admin/laximo-cat/quota/reset       # сброс счётчика за день (admin)
```

`GET integration` для админа включает: `requests_today`, `daily_request_limit`, `requests_remaining`, `quota_exhausted`, точные error-поля.

Доступ: только `get_current_admin_user`. Audit log при сохранении ключей / тесте / включении / сбросе квоты.

---

## Карта этапов (обзор)

| Этап | Цель | Сценарий из capabilities | Методы CAT |
|------|------|--------------------------|------------|
| **0** | Админка ключей + квота + клиент + тест + мягкие reason | подготовка / гейт | `ListCatalogs` |
| **1** | VIN → карточка авто | **B** | `FindVehicle`, опц. `GetVehicleInfo` |
| **2** | Гараж + разборка по VIN | **B** в продукт | те же + decode API |
| **3** | VIN → дерево узлов → OEM | **C** + часть **A** | Categories/Units/Details (+ quickgroups) |
| **4** | VIN в поиске + наличие на складе | **A** витрина | OEM → ROSSKO + б/у |
| **5** | Усиление | пробелы §3 capabilities | DOC, plate, applicability, fulltext |

Порядок: **0 → 1 → 2 → 3 → 4 → 5**. Этап 2 опирается на 1; 3 — на 1; 4 — на 3.  
Без успешного этапа 0 (ключи + тест + enable + квота не исчерпана) этапы 1–4 в рантайме **не вызывают** CAT (или сразу отдают публичный soft-fail).

---

## Этап 0 — /admin-settings: ключи, квота, тест API, HTTP-клиент

### Цель

Админ вводит логин/пароль Laximo.CAT в `/admin-settings`, сохраняет, проверяет API (`ListCatalogs`), задаёт дневной лимит запросов и видит остаток. Только после успешной проверки и включения тумблера (и при наличии остатка квоты) интеграция считается рабочей. Клиент CAT читает credentials из БД; счётчик запросов и маппинг ошибок в публичные soft-сообщения закладываются здесь.

### В scope

**Админка (обязательно)**

- Модель + миграция/schema patch для `site_laximo_cat_integration` (включая поля квоты)
- Шифрование секретов (как OpenRouter crypto / общий secret box)
- Роутер `/admin/laximo-cat/*` (см. § «Гейт»)
- UI-секция `LaximoCatSection.jsx` на `AdminPanelPage`:
  - credentials + test + enable
  - **счётчик:** использовано / лимит / осталось; предупреждение при низком остатке и при исчерпании
  - сброс дневного счётчика (admin)
- Флоу: сохранить → **Проверить API** → при OK разрешить **Включить**
- При смене пароля/логина: сбросить verification
- Админские алерты с **правдой** (лимит, upstream) — только в этой секции

**Клиент + гейт**

- `cat_client.py`: POST, Basic Auth из БД, locale `ru_RU`, timeout
- `list_catalogs()` для теста и кэша features
- `laximo_cat_ready(db)` учитывает квоту
- `increment` / суточный rollover счётчика
- `map_to_public_reason` + константа публичного текста (одна на все техсбои)
- Опциональный env-fallback только для dev

**UX-заготовка**

- Компонент `SoftServiceNotice` (или аналог) в стиле сайта — чтобы этапы 2/4 не изобретали баннер заново; можно подключить уже на этапе 0 как story/preview в админке не обязательно, но файл компонента — да

**Вне scope**

- decode-vin продукт, гараж UI флоу, каталог узлов, ROSSKO-матчинг

### Зависимости

Нет (первый этап).

### Критерии готовности

- [ ] На `/admin-settings` секция Laximo.CAT с ключами, тестом, enable и блоком квоты (N из M / осталось)
- [ ] Сохранение не отдаёт пароль на фронт
- [ ] Успешный тест → можно включить; неуспешный → нельзя держать «как рабочее» без нового теста
- [ ] При `requests_today >= limit` ready=false; админ видит «лимит исчерпан»
- [ ] Публичный маппер ошибок не содержит запрещённых слов (квота/API/Laximo)
- [ ] Пароль не в логах

### Промпт

```
Сделай план для этапа 0 по @docs/laximo-stages-plan.md
Ключи и дневная квота только через /admin-settings: сохранить → проверить ListCatalogs → включить.
Счётчик запросов и остаток для админа. Пользователю при сбоях/квоте — только мягкое «сервис временно недоступен», без упоминания лимита.
HTTP-клиент из БД. Продуктовый VIN UI не делать, кроме SoftServiceNotice-заготовки.
```

---

## Этап 1 — VIN → нормализованная карточка авто (сценарий B)

### Цель

По VIN получать марку/модель/год/двигатель/кузов и т.д. через BFF, с учётом нестабильных `attributes` и нескольких кандидатов. Вызов CAT — **только если** `laximo_cat_ready()`.

### В scope

- В начале `by-vin`: если не ready / квота / ошибка клиента → публичный `{ ok: false, reason: temporarily_unavailable, message: <мягкий текст> }` без запроса в Laximo (или после fail upstream — тот же публичный ответ)
- Инкремент счётчика квоты на реальных вызовах FindVehicle
- `FindVehicle(identString=VIN, localized=true)` — основной метод (REST)
- Опционально `GetVehicleInfo` для добора полей
- `vehicle_normalize.py`: `brand`/`name`/`attributes` → единая структура сайта  
  (`make`, `model`, `year`, `engine`, `transmission`, `body`/`frame`, `color`, raw attributes)
- BFF эндпоинт, например: `POST /laximo/vehicles/by-vin` → `{ ok, candidates[], reason, message? }`
- Обработка: 0 кандидатов / 1 / много; прокидка `catalog`, `vehicleId`, `ssd`, `filter_level`
- Кэш ответа FindVehicle (короткий TTL) — желательно
- Юнит-тесты нормализатора + тесты: квота исчерпана → публичный reason без слова «лимит»
- Тесты гейта: без ready FindVehicle не вызывается

### Вне scope

- Подключение к гаражу/разборке UI (это этап 2)
- ListCategories / узлы (этап 3)
- Wizard как основной путь (только не делать; в гараж wizard не класть — см. capabilities §3.5)
- Переделка админки ключей (уже этап 0)

### Ограничения из capabilities (учесть в плане)

- Attributes не стандартизированы — не ждать одно поле `body` у всех брендов
- Не все каталоги с `vinsearch`
- Один VIN → несколько строк → UI выбора позже (на этапе 1 API уже отдаёт `candidates[]`)

### Зависимости

Этап 0 (админка + ready-гейт + cat_client).

### Критерии готовности

- [ ] При выключенной/непроверенной/без квоты интеграции — `temporarily_unavailable` + мягкий `message`, сеть к Laximo не дергается
- [ ] В ответе клиенту нет внутренних reason вроде `quota_exhausted`
- [ ] При ready: VIN → нормализованные поля + raw; мульти-кандидаты не схлопываются
- [ ] `ssd` / `catalog` / `vehicleId` возвращаются при успехе
- [ ] VIN ≠ 17 / пустой → 400 с понятным текстом
- [ ] Счётчик `requests_today` растёт после реального FindVehicle

### Промпт

```
Сделай план для этапа 1 по @docs/laximo-stages-plan.md
VIN → FindVehicle → нормализация → BFF /laximo/vehicles/by-vin.
Гейт laximo_cat_ready() + квота; публично только temporarily_unavailable / not_found.
Без UI гаража и без дерева узлов.
```

---

## Этап 2 — Внедрение карточки VIN в гараж и разборку (сценарий B → продукт)

### Цель

Заменить stub decode-vin и предзаполнять авто при добавлении в гараж и в разборку. Если интеграция не ready — UI не обещает автозаполнение (подсказка / скрыть кнопку поиска по VIN).

### В scope

**Гараж**

- Реализовать `POST /autoservice/garage/decode-vin` через сервис этапа 1 (не оставлять вечный stub `not_found`)
- Публичные reason: `temporarily_unavailable` | `not_found` (внутренние коды — только в логах/админке)
- Расширить response: candidates / нормализованные поля / laximo refs + `message` для UI
- UI `GaragePage` / staff modal: при soft-fail показать **`SoftServiceNotice`** (стилистика сайта) и оставить ручной ввод
- Выбор кандидата → предзаполнение формы
- Fallback: VIN не найден **или** сервис недоступен → ручной ввод без паники
- Миграция по желанию: `source=laximo`, snapshot attributes / catalog / vehicleId

**Разборка (`/vehicles`)**

- Блок «Найти по VIN» в форме добавления (`VehicleModal` / AddVehicle)
- Если публичный статус «VIN-поиск недоступен» — не писать «настройте в админке» обычным продавцам/клиентам: тот же мягкий текст + ручной/TecDoc путь
- Предзаполнение brand/model/engine/VIN при успехе; TecDoc cascade не ломать
- Опционально сохранить laximo refs рядом с TecDoc-полями

### Вне scope

- Каталог узлов в поиске (этап 3–4)
- Госномер / Frame (этап 5)
- Wizard в гараж (запрещено по рекомендации Laximo)
- UI ввода ключей (этап 0)

### Зависимости

Этапы 0–1.

### Точки кода (ориентиры)

- `backend/app/routers/autoservice_garage.py` — stub decode-vin
- `backend/app/schemas/garage_vehicle.py`
- `frontend/.../Garage/GaragePage.jsx`
- `frontend/.../MyParts/AddPart/VehicleModal.jsx`, `Vehicles/AddVehiclePage.jsx`
- `AdminPanelPage` / `LaximoCatSection` — только чтение статуса, не дублировать форму ключей

### Критерии готовности

- [ ] Без ready / квота: decode не ходит в Laximo; UI показывает SoftServiceNotice, не техпричину
- [ ] В UI нет слов «лимит», «API», «Laximo», «квота»
- [ ] С ready: VIN заполняет make/model/year; мульти-кандидат → выбор
- [ ] not_found → отдельный понятный текст + ручной ввод
- [ ] Разборка и TecDoc без VIN работают

### Промпт

```
Сделай план для этапа 2 по @docs/laximo-stages-plan.md
Живой decode-vin в гараже + VIN на форме разборки.
SoftServiceNotice при временно недоступном сервисе (в т.ч. квота) — без раскрытия причины.
Каталог узлов и поиск не трогать.
```

---

## Этап 3 — VIN → категории / узлы / OEM-детали (сценарии C + A ядро)

### Цель

После идентификации авто открыть дерево узлов и список OEM (без витрины цен).

### В scope

Типовой поток из capabilities:

```
VIN → FindVehicle → (выбор авто)
  → ListCategories (categoryId=-1)
  → ListUnits
  → GetUnitInfo
  → ListDetailByUnit
  → ListImageMapByUnit (опционально)
```

Если у каталога feature `quickgroups`:

```
→ ListQuickGroup → ListQuickDetail
```

- BFF эндпоинты categories / units / unit details / image map / quick-groups
- Хранение/прокидка **`ssd`** на каждом шаге (обязательно)
- Проверка features через кэш `ListCatalogs` (из этапа 0)
- Минимальный UI **или** API-only + простая страница-песочница (на выбор в плане): просмотр дерева и OEM
- Обработка `filter` у деталей: хотя бы не падать; полный `GetFilterByDetail` можно отложить на этап 5

### Вне scope

- Детект VIN в шапке поиска сайта (этап 4)
- Матчинг ROSSKO / б/у / аналоги (этап 4)
- SearchVehicleDetails fulltext (этап 5)

### Зависимости

Этапы 0–1 (`laximo_cat_ready` + FindVehicle). Этап 2 желателен, но для песочницы каталога достаточно этапа 1.

### Критерии готовности

- [ ] Эндпоинты узлов при не-ready / квоте → `temporarily_unavailable` + мягкий message, без вызова Laximo
- [ ] Для выбранного candidate открываются категории (или quick groups)
- [ ] Узел показывает OEM-список (`oem`, name); счётчик квоты растёт на реальных вызовах
- [ ] Без валидного `ssd` — понятная ошибка (не светить внутренности CAT)
- [ ] Каталог без `quickgroups` идёт через Categories/Units

### Промпт

```
Сделай план для этапа 3 по @docs/laximo-stages-plan.md
Дерево узлов и OEM после VIN. Гейт + квота; пользователю soft-fail без техдеталей.
Без матчинга склада и без search bar.
```

---

## Этап 4 — VIN в поиске + оригинал / Rossko / б/у (сценарий A витрина)

### Цель

Ввод VIN в поисковую строку → на странице новых сначала авто, потом узлы, у каждой OEM — наличие у нас / Rossko / б/у.

### В scope

- Детект VIN (17 символов, без I/O/Q) в `Search.jsx` / resolve `/find`
- Если Laximo **не ready** / квота / сбой — VIN в поиске: SoftServiceNotice + fallback на обычный поиск или ручной путь; **не** писать про админку/лимит
- Если ready: VIN → VIN-каталог на `/autoparts/new` (или отдельный route)
- UX шаги: кандидаты авто → узлы (этап 3) → детали
- Матчинг на OEM:
  - **б/у** — локальный каталог / `search-used-parts` по нормализованному артикулу
  - **новый/оригинал** — ROSSKO `GetSearch` по OEM
  - блок «нет в наличии», если пусто
- UI у строки детали: оригинал | (заглушка аналогов) | б/у
- Публичный флаг «VIN-каталог доступен» с бэка (из `laximo_cat_ready`), чтобы фронт не гадал

### Вне scope

- Полноценные aftermarket-кроссы через Laximo.DOC (этап 5)
- «Все запчасти в наличии под VIN» одним запросом (в CAT нет — не обещать)
- Wizard / plate
- Форма ключей в админке (этап 0)

### Ограничения из capabilities §3.2

CAT не даёт цены/наличие — только OEM. Витрина = наша склейка.

### Зависимости

Этапы 0–1 и 3 (дерево узлов + гейт). Этап 2 — независимо, но полезен.

### Точки кода (ориентиры)

- `frontend/.../Navigation/Search/Search.jsx`
- `FindRedirectPage`, `search_resolve_service.py` / `search_query.py`
- `NewParts*` / новый `VinCatalog*` flow
- ROSSKO router + local product search

### Критерии готовности

- [ ] Без ready / квота: SoftServiceNotice, сайт не «ломается», нет утечки причины
- [ ] С ready: VIN → выбор авто → узлы → OEM с наличием ROSSKO/б/у
- [ ] Обычный поиск по артикулу/названию не сломан

### Промпт

```
Сделай план для этапа 4 по @docs/laximo-stages-plan.md
VIN в search bar → каталог → OEM + ROSSKO/б/у.
При недоступности (в т.ч. квота) — красивый SoftServiceNotice, без слов про лимит/API.
Без Laximo.DOC кроссов.
```

---

## Этап 5 — Усиление (пробелы capabilities §3)

### Цель

Закрыть то, чего не хватает «чистому» CAT для полного продукта.

### В scope (подэтапы — в плане выбрать приоритет)

| Подэтап | Что | Зачем |
|---------|-----|------|
| 5a | Laximo.DOC `FindOEM` → кроссы | колонка «аналог» |
| 5b | Госномер `identifyByPlateNumber(Full)` | гараж/разборка без VIN |
| 5c | Frame-поиск | японский рынок |
| 5d | `GetOEMPartApplicability` / `FindApplicableVehicles` | fitment на карточке товара |
| 5e | `SearchVehicleDetails` | поиск «колодки» внутри VIN-авто |
| 5f | `GetFilterByDetail` / `GetFilterByUnit` | сложные комплектации |
| 5g | Wizard fallback | только если VIN не найден; **не** сохранять в гараж по умолчанию |

### Вне scope одного прогона

Не делать все 5a–5g сразу: в промпте указать, например, «только 5a и 5b».

### Зависимости

Этапы 0–4 для витрины; для 5b/5c достаточно 0–2.

### Критерии готовности

Зависят от выбранных подэтапов; в плане агент обязан выписать чеклист под выбранные буквы.

### Промпт (пример)

```
Сделай план для этапа 5 по @docs/laximo-stages-plan.md
Только подэтапы 5a (DOC аналоги) и 5b (госномер). Остальное этапа 5 не планировать.
```

---

## Шаблон ответа агента в Plan mode

На любой этап план должен содержать:

1. **Цель этапа** (1–2 предложения)
2. **Зависимости** — что уже должно быть в репо (включая состояние гейта `/admin-settings`)
3. **Гейт + квота** — `laximo_cat_ready()`, публичный vs админский reason, тексты SoftServiceNotice
4. **Файлы** — создать / изменить (пути)
5. **API-контракты** — request/response (публичный `message` без техслов)
6. **Методы Laximo** — список
7. **Шаги реализации** — нумерованный список
8. **Тест-план** — обязательно сценарии: ключи не введены; тест не пройден; **квота = 0**; upstream 403; VIN not_found
9. **Вне scope** — явно
10. **Риски** — capabilities + утечка секретов/квоты пользователю

После «реализуй» — не выходить за этот список без спроса.

---

## Быстрая шпаргалка методов

| Метод / действие | Этап |
|------------------|------|
| `/admin-settings` ключи + тест + **квота (осталось N)** + `is_enabled` | **0** |
| `laximo_cat_ready()` + публичный soft-fail | **0** (везде дальше) |
| `SoftServiceNotice` пользовательский баннер | **0** (заготовка), **2–4** |
| `FindVehicle` | 1–4 |
| `GetVehicleInfo` | 1–2 |
| decode-vin / garage / vehicles UI | 2 |
| `ListCategories` → `ListUnits` → `GetUnitInfo` → `ListDetailByUnit` | 3–4 |
| `ListImageMapByUnit` | 3–4 |
| `ListQuickGroup` / `ListQuickDetail` | 3–4 |
| OEM → ROSSKO + used | 4 |
| DOC / plate / Frame / applicability / fulltext / filters / wizard | 5 |

---

## Связь со сценариями capabilities

| Сценарий | Этапы |
|----------|-------|
| **B** Инфо об авто по VIN | 1 → 2 |
| **C** Дерево узлов по VIN | 3 |
| **A** Запчасти по VIN + витрина | 3 (OEM) → 4 (наличие) → 5a (аналоги) |

Оптимальная схема продукта (capabilities §6):

**CAT по VIN → нормализованная карточка + OEM → склад / поставщики по артикулу.**
