# Devin: памятка по проекту «Свой Гараж»

Этот файл — долгосрочная память для Devin. Здесь собраны команды, соглашения, критичная бизнес-логика и правила безопасности, специфичные для проекта. Если в процессе работы выясняется что-то важное и постоянное, дополняй этот файл.

## 1. Общие сведения

- **Название:** Свой Гараж
- **Репозиторий:** `C:\Users\khram\OneDrive\Рабочий стол\autoparts`
- **Git remote:** `https://github.com/mreglen/autoparts.git`
- **Текущая ветка:** `celery_update`
- **Стек:** React SPA + FastAPI + PostgreSQL + Redis + Celery
- **Продакшен:** `https://svoygarage.ru`
- **Публичный API путь:** `https://svoygarage.ru/server/api`
- **Backend внутри:** `127.0.0.1:8080`

## 2. Структура проекта

```text
autoparts/
├── backend/                 # FastAPI + SQLAlchemy + Pydantic + Alembic
│   ├── app/
│   │   ├── main.py          # точка входа, schema patches
│   │   ├── models/          # SQLAlchemy модели
│   │   ├── routers/         # FastAPI endpoints
│   │   ├── services/        # бизнес-логика
│   │   ├── schemas/         # Pydantic-схемы
│   │   ├── utils/           # утилиты и хелперы
│   │   ├── db/              # database.py, schema_patches.py
│   │   └── celery_app.py    # Celery
│   ├── requirements.txt
│   └── .env.example
├── frontend/my-autoparts/   # React 19, Redux Toolkit, React Router 7, Tailwind
│   ├── src/
│   │   ├── pages/           # страницы
│   │   ├── components/      # компоненты
│   │   ├── redux/           # store/slices
│   │   ├── hooks/           # кастомные хуки
│   │   └── utils/           # хелперы
│   ├── package.json
│   └── .env.example
├── scripts/
│   ├── deploy/update.sh     # единый production deploy
│   └── devin-guard.ps1      # PreToolUse-хук: блокирует деструктивные команды
├── .devin/
│   ├── config.json          # permissions (allow/ask/deny)
│   ├── hooks.v1.json        # lifecycle-хуки
│   ├── mcp_config.local.json # MCP-серверы (gitignored, ключи)
│   └── skills/              # /deploy, /verify, /review, /new-endpoint, /new-autoservice-page
└── docs/ops/                # systemd units, nginx, pgbouncer, backup
```

## 3. Локальный запуск

### 3.1 Подготовка окружения

```bash
cp backend/.env.example backend/.env
cp frontend/my-autoparts/.env.example frontend/my-autoparts/.env
```

Отредактируй `backend/.env` и `frontend/my-autoparts/.env` локальными значениями.

### 3.2 Backend

```bash
cd backend
python -m venv venv
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
# source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### 3.3 Celery worker

```bash
cd backend
# Windows: activate venv
.\venv\Scripts\Activate.ps1
celery -A app.celery_app worker --loglevel=info
```

### 3.4 Frontend

```bash
cd frontend/my-autoparts
npm ci
npm start
```

- Frontend: `http://localhost:3000`
- API: `http://127.0.0.1:8080`

## 4. Тестирование и сборка

### Backend

```bash
cd backend
python -m unittest tests.test_backup_service        # пример
python -m unittest tests.<module>
```

### Frontend

```bash
cd frontend/my-autoparts
npm test -- --watchAll=false
npm run build
```

Сборка может завершаться с предупреждениями:

- missing source maps от camera package;
- stale Browserslist;
- существующие ESLint warnings.

Эти warning — не ошибки, если `npm run build` возвращает exit 0.

### E2E

```bash
cd frontend/my-autoparts
npx playwright test
```

## 5. Деплой

### 5.1 Инфраструктура

- **Сервер:** `/home/fast/autoparts`
- **Backend venv:** `/home/fast/autoparts/backend/venv`
- **Frontend build:** `/var/www/my-autoparts`
- **Backend сервис:** `kroan.service`
- **Celery сервис:** `celery.service`
- **Unit Gunicorn:** `docs/ops/kroan.service`

### 5.2 Production update

Запускать только от root, только после коммита и пуша в текущую ветку, и только по явному запросу пользователя.

```bash
sudo update
```

`update` — это `/usr/local/bin/update`, синхронизируемый из `scripts/deploy/update.sh`.

Доступные опции:

```text
--frontend-only  Только git pull + сборка/выкладка frontend
--backend-only   Только git pull + pip + перезапуск kroan/celery
--skip-frontend  Не собирать frontend
--skip-backend   Не перезапускать kroan/celery
--rollback       Откат к предыдущему успешному SHA
--nginx          Обновить nginx-конфиги из репозитория и reload nginx
```

### 5.3 Что делает update

1. `git fetch origin <branch>` + `git reset --hard origin/<branch>` + `git clean -fd`.
2. Сохраняет `backend/.env` и `frontend/.env`, остальное локальное сбрасывается.
3. `pip install -r requirements.txt` (если изменился requirements).
4. `npm ci` + `npm run build` и rsync в `/var/www/my-autoparts`.
5. `systemctl restart kroan.service`, затем `celery.service`.
6. Health-checks через curl, проверка gunicorn/pgbouncer/nginx.

### 5.4 Проверка после деплоя

- Открыть `https://svoygarage.ru` и нажать `Ctrl+F5`.
- `systemctl is-active kroan.service`
- `systemctl is-active celery.service`
- `curl -s -o /dev/null -w '%{http_code}' https://svoygarage.ru/server/api/auth/public-site-config`

## 6. Соглашения по коду

### 6.1 Общие

- Не добавлять и не удалять комментарии без явной просьбы.
- Писать компактный код: убирать дублирующие `else`, излишнюю вложенность.
- Не пытаться угадать доступность библиотеки — проверять `package.json`, `requirements.txt` или соседние файлы.
- При добавлении зависимостей предпочитай версии, опубликованные более 7 дней назад. Избегай плавающих диапазонов (`latest`, `*`, `>=x` без upper bound).
- Никогда не коммить секреты, API-ключи, пароли.

### 6.2 Python / FastAPI

- SQLAlchemy 2.0 style ORM.
- Pydantic v2.
- Все сущности, привязанные к организации, обязаны фильтроваться по `organization_id`.
- `order_number` в `repair_orders` — строка (`String(32)`), nullable, сравнивать только со строками.

### 6.3 Frontend / React

- React 19, Redux Toolkit, React Router 7, Tailwind.
- Компактные таблицы: 12px, узкие строки, `text-ellipsis` для длинных имён.
- Действия строки по возможности переносить в модальное окно.
- **Эталон десктопных таблиц — `/autoservice/warehouse`:** все таблицы в ПК-версии должны выглядеть одинаково — узкие строки (`py-2`), `text-xs`, `table-fixed`, uppercase-заголовки `text-xs`, без кнопок действий в строках (строка кликабельная, действия — в модалке). Столбцы могут отличаться, стиль — нет.
- Не писать табличные классы вручную — использовать общие `autoserviceList*Class` из `frontend/my-autoparts/src/utils/warehouseListUi.js` (`autoserviceListTableClass`, `autoserviceListTheadRowClass`, `autoserviceListThClass`, `autoserviceListTbodyClass`, `autoserviceListTrClass`/`autoserviceListTrClickableClass`, `autoserviceListTdClass` и т.д.).
- Оповещения о результате действий (успех/ошибка сохранения, удаления, запуска операции и т.п.) — только через общий `Toast` (`frontend/my-autoparts/src/components/UI/Toast.jsx`, default export): выезжает сверху справа, сам скрывается через `durationMs` (default 6000), `onClose` обязан очистить message-state. Пример: `<Toast message={error} variant="error" onClose={() => setError('')} />`, для успеха `variant="success"`. Inline-баннеры для таких уведомлений не делать. Inline остаются только: ошибки полей форм, блокирующие состояния (страница не может отрендериться без данных), постоянные предупреждения и индикаторы процесса («Загрузка…», «Сохранено» в тулбаре).
- Не коммитить source maps и build-артефакты (они в `.gitignore`).

## 7. Критичная бизнес-логика

### 7.1 Rossko

- Показывать только предложения с доставкой. Склады только с самовывозом (`pickup`) исключаются.
- Админ-выбор складов в `/admin/rossko` — не whitelist, а список предпочтительных складов для визуального выделения жирным.
- Доставка определяется по наличию полного окна `deliveryStart` + `deliveryEnd`.
- При сетевой ошибке или неполном ответе корзина сохраняет уже выбранное количество и последнее известное окно доставки, не сбрасывает позицию.

### 7.2 Заказ-наряды (repair orders)

- `order_number` — строка, нумерация `1, 2, 3…` внутри каждой организации.
- Уникальность по паре `(organization_id, order_number)`.
- Разные организации могут иметь одинаковый `order_number` (например, №16 у каждой организации).
- Глобально заказ идентифицируется по `id`.
- Текущая аллокация номера в `app/utils/repair_order_number.py` неатомарна: при одновременном создании двух заказов одной организацией возможен `IntegrityError`.

### 7.3 Автосервис / склад

- `warehouse` показывает закупочную цену; `expenses` — продажную.
- Для `warehouse` таблиц компактный стиль: `Наименование`, `Кол-во`, `Цена`, `Сумма`.
- `Сумма = Цена × Кол-во`.
- Возврат доступен внутри модали позиции.

### 7.4 Организации

- Почти все сущности привязаны к `organization_id`.
- Запросы к заказ-нарядам, складам, клиентам и т.д. всегда должны включать фильтр по `organization_id`.

### 7.5 Сессии и токены

- Access JWT живёт `ACCESS_TOKEN_EXPIRE_MINUTES` (30 мин), фронт молча обновляет его через `POST /auth/refresh` при 401 (`apiClient.js`).
- `REFRESH_TOKEN_EXPIRE_DAYS` (default 365) — при каждом refresh продлевается sliding-окно, активный пользователь не разлогинивается.
- Планировщик в `main.py` раз в час вызывает `cleanup_expired_sessions` — удаляет только мёртвые сессии (истёк `refresh_expires_at`, `is_active=False` >24ч, легаси без refresh >24ч). Не возвращать очистку по `last_activity` — это разлогинивает пользователей через сутки неактивности.
- `cleanup_old_user_sessions` — максимум 5 сессий на пользователя с одного IP (на логине).

### 7.6 Начисления ЗП (payroll)

- Начисления **материализуются** в `autoservice_payroll_accruals` — отчёты (`/autoservice/reports/payroll`) и страница сотрудника (`/autoservice/my/payroll`) читают эту таблицу по `accrued_at`, а не считают на лету.
- Создаются при переходе заказа в `completed` (`accrue_order_payroll`), удаляются при выходе из `completed`, удалении заказа и удалении оплаты (`clear_order_accruals`).
- При редактировании работ/исполнителей завершённого заказа (PATCH `repair-orders/{id}`) начисления пересчитываются с `accrued_at = status_completed_at` — начисление остаётся в месяце завершения заказа.
- Изменение работ заказа идёт только через `_replace_works` в PATCH — других путей нет.

## 8. Типичные ошибки

### 8.1 Заказ-наряды

```python
# Неправильно:
RepairOrder.order_number == 16

# Правильно:
RepairOrder.order_number == "16"
```

### 8.2 Gunicorn

После обновления backend stale workers могут не перезагрузиться по `HUP`. Использовать:

```bash
systemctl restart kroan.service
```

### 8.3 Frontend build

- `Adjacent JSX elements must be wrapped in an enclosing tag` — проверить структуру `&&` условий.
- `'stats' is not defined` — удалить использование переменных, которые больше не вычисляются.

### 8.4 Проверка frontend после деплоя

Использовать `Ctrl+F5`, чтобы сбросить кэш браузера.

### 8.5 Мобильная раскладка: `min-h-dvh` + `flex-1`

- На мобильном скролл живёт в `#root` (`html.mobile-shell`: `body` fixed, `#root { height:100%; overflow-y:auto }`).
- `MobileShellFrame` использует `min-h-dvh` (не `h-dvh`) — высота shell **неопределённая**, поэтому `flex-1` (`flex-basis:0%`) у детей резолвится в `content`, и колонка растёт по контенту вместо ограничения вьюпортом.
- Поэтому «прибитые» экраны (активный чат в `ChatsHubPage`) делаются через `max-lg:fixed max-lg:inset-0` на панели — не через `h-full`/`flex-1`-цепочку.
- Shell на мобильном — `flex-col` контейнер: у прямых детей с `mx-auto` и `width:auto` авто-маргины отключают `stretch`, элемент сжимается до `fit-content` и центрируется. Поэтому `<main>` обязан иметь `w-full` (иначе страницы с узким контентом — настройки, записи — получают широкие боковые отступы).

## 9. Безопасность и процесс

- **Никогда** не запускать production `update` без явного запроса пользователя.
- **Никогда** не пушить в remote без просьбы.
- **Никогда** не делать `rm -rf`, force-push, `git reset --hard` на локальных пользовательских изменениях, rewrite history, удалять ветки.
- Не трогать базу данных destructive-операциями без подтверждения.
- Сохранять несвязанные рабочие изменения (`scripts/ops/health-monitor.sh`, `.requirements.sha256` и другие пользовательские правки).
- Секреты только в `.env`/секрет-менеджер, никогда в Git.
- Перед деплоем убедиться, что нужные изменения закоммичены и запушены.
- Git: делать коммиты через `git commit` с чистым сообщением, фокусом на «почему», а не «что». Не обновлять `git config`.

## 10. Ссылки и ключевые файлы

- `README.md` — быстрый старт
- `backend/.env.example`
- `frontend/my-autoparts/.env.example`
- `scripts/deploy/update.sh`
- `docs/ops/kroan.service`
- `backend/app/utils/repair_order_number.py`
- `backend/app/models/repair_order.py`
- `backend/app/db/schema_patches.py`

---

Последнее обновление: 2026-09-15
