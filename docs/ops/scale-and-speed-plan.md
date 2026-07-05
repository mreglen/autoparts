# План ускорения и масштабирования svoygarage.ru

**Как пользоваться:** прикрепите этот файл в чат (Plan mode) и напишите, например: `Этап 1`.  
Агент выполнит задачи этапа (код + SSH на сервер), в конце вы запускаете `update` на сервере.

**Сервер:** `195.24.65.251` (`vm2512296768`)  
**Деплой:** только через `update` / `update --nginx` (скрипт `scripts/deploy/update.sh` → `/usr/local/bin/update`)

---

## Общие правила

| Правило | Зачем |
|---------|-------|
| Один `update` за раз, не рестартить `kroan` вручную подряд | избежать 502/504 (окно 8–12 с) |
| После `update` подождать ~15 с и проверить smoke | API должен ответить до проверки в браузере |
| Секреты не коммитить | `.env` только на сервере |
| Baseline фиксировать в `docs/ops/performance.md` | сравнение «до/после» |

**Smoke после каждого этапа (на сервере):**
```bash
systemctl is-active kroan nginx postgresql redis-server celery
curl -s -o /dev/null -w 'cart:%{http_code}\n' http://127.0.0.1:8080/api/cart/
curl -s -o /dev/null -w 'part-types:%{http_code}\n' -H 'Host: svoygarage.ru' \
  https://127.0.0.1/server/api/part-types/public -k
curl -s -o /dev/null -w 'catalog:%{http_code}\n' -H 'Host: svoygarage.ru' \
  "https://127.0.0.1/server/api/catalog/products?page=1&page_size=1" -k
```

**В браузере (гость, без входа):**
- `/autoparts/used` — список и фильтры
- `/autoparts/new` — лендинг
- клик в карточку б/у и новой запчасти — без долгой паузы

---

## Этап 1 — Стабильность production (срочно)

**Цель:** убрать частые 502/504 из-за рестартов, битого `.env` и отсутствующих каталогов.

### Задачи агента

**На сервере (SSH, ops):**
- [ ] Исправить пробелы в `/home/fast/autoparts/backend/.env` (`KEY=value`, без кавычек)
- [ ] Создать `/home/fast/autoparts/backend/uploads/vehicle_pictures`, `chown fast:fast`
- [ ] Убедиться, что `update.sh` на сервере без синтаксических ошибок (синхронизируется из репо)
- [ ] Проверить: `kroan`, `nginx`, `postgresql`, `redis`, `celery` — active
- [ ] Зафиксировать текущие 502/504 в nginx log (baseline для сравнения)

**В репозитории:**
- [ ] `scripts/deploy/update.sh` — `fix_backend_env`, `ensure_upload_dirs` (уже есть; проверить работу)
- [ ] Документировать baseline 502/504 в этом файле (секция «Прогресс»)

### Деплой пользователя

```bash
# На сервере от root — только если менялся код в репо:
update
```

Если менялся только `.env`/каталоги на сервере — достаточно одного рестарта через `update` или уже выполненного `systemctl restart kroan` агентом.

### Критерии готовности

- [ ] В логах `kroan` нет `vehicle_pictures не найден`
- [ ] `curl` cart/part-types/catalog → 200 (или cart 401 локально)
- [ ] Нет предупреждений `python-dotenv could not parse` в journalctl за последний час
- [ ] ≤1 рестарт `kroan` после этапа (не несколько подряд)

### Команда для Plan mode

```
Этап 1 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 2 — Baseline метрик (измерения)

**Цель:** зафиксировать «до», чтобы не оптимизировать вслепую.

### Задачи агента

**На сервере:**
- [ ] TTFB публичного API:
  ```bash
  curl -s -o /dev/null -w 'catalog TTFB:%{time_starttransfer}s total:%{time_total}s\n' \
    -H 'Host: svoygarage.ru' \
    "https://127.0.0.1/server/api/catalog/products?page=1&page_size=20" -k
  ```
- [ ] Размер main JS bundle, gzip/br
- [ ] Счётчик 502/504 за последние 24 ч в nginx access log
- [ ] `journalctl -u kroan` — число рестартов за 24 ч

**В репозитории:**
- [ ] Заполнить таблицу в `docs/ops/performance.md` (LCP/TTFB для `/`, `/autoparts/used`, `/autoparts/new`, карточек)
- [ ] PageSpeed Insights / WebPageTest — ссылки или скриншоты (по возможности)

### Деплой пользователя

```bash
# Код не обязателен — только обновление docs:
update --skip-backend
# или без update, если менялся только performance.md локально
```

### Критерии готовности

- [ ] Таблица baseline в `performance.md` заполнена
- [ ] Есть цифры TTFB catalog и счётчик 502/504 «до»

### Команда для Plan mode

```
Этап 2 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 3 — Nginx: microcache, Brotli, prerender

**Цель:** снизить нагрузку на единственный uvicorn; меньше 504 от ботов.

### Задачи агента

**На сервере:**
- [ ] Каталоги кэша:
  ```bash
  mkdir -p /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check
  chown www-data:www-data /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check
  ```
- [ ] Snippet microcache в `/etc/nginx/snippets/svoygarage-microcache.conf`
- [ ] `include` microcache в `nginx.conf` (блок `http {}`), если ещё нет
- [ ] Проверить `X-Cache-Status: HIT` на повторном запросе catalog/part-types
- [ ] Brotli: `nginx -V | grep brotli` → если модуль есть, подключить `svoygarage-brotli.conf`
- [ ] Prerender: увеличить `proxy_read_timeout` только на `/_internal/*-prerender` (если 504 от ботов)

**В репозитории:**
- [ ] `docs/nginx/svoygarage.conf` — microcache для catalog, part-types, public-site-config
- [ ] `docs/nginx/http-microcache.conf`
- [ ] `scripts/deploy/update.sh` — `apply_nginx_configs` при `--nginx`
- [ ] Опционально: microcache для prerender-ответов (отдельная зона, TTL 5–15 мин)

### Деплой пользователя

```bash
update --nginx
```

### Критерии готовности

- [ ] `nginx -t` OK
- [ ] Второй запрос catalog → `X-Cache-Status: HIT` (или MISS → HIT)
- [ ] 504 на prerender в error.log не растут после деплоя
- [ ] Brotli включён ИЛИ задокументирована причина отказа

### Команда для Plan mode

```
Этап 3 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 4 — Backend: тяжёлое вне uvicorn + кэш поиска

**Цель:** API не блокируется sitemap/SEO и долгими задачами при старте.

### Задачи агента

**В репозитории:**
- [ ] `backend/app/main.py` — sitemap warm-up только отложенно / в Celery (не блокировать startup)
- [ ] `NEW_PARTS_SEO_SYNC_USE_CELERY=true` в prod `.env` (проверить на сервере)
- [ ] Redis-кэш для `/search-products/search` и `/resolve` (TTL 60–120 с)
- [ ] Инвалидация `catalog:*`, `products:public:*`, `search:*` при изменении товара
- [ ] `schema_patches.py` — не логировать «Applied» при повторном старте (опционально)

**На сервере:**
- [ ] Проверить `celery` active, очереди без залипших задач
- [ ] Время старта `kroan` после рестарта < 5 с до `Application startup complete` (без blocking sitemap)

### Деплой пользователя

```bash
update
```

### Критерии готовности

- [ ] Старт API < 5 с (без 3–4 с sitemap warm-up в critical path)
- [ ] SEO sync идёт через Celery (логи `celery`, не `kroan`)
- [ ] Поиск `/find?q=...` — повторный запрос быстрее (Redis HIT в логах или по latency)

### Команда для Plan mode

```
Этап 4 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 5 — Frontend: скорость каталога и карточек

**Цель:** быстрый первый экран и мгновенные переходы в карточки.

### Задачи агента

**В репозитории (проверить / доделать):**
- [ ] `UsedPartsList` / `NewPartsResults` — lazy chunks в `AutoParts.jsx`
- [ ] `prefetchPartDetail.js` — prefetch на hover/touch
- [ ] `NewPartProductCard` — переход без блокирующих API до `navigate`
- [ ] `MainLayout` — без `Outlet key={pathname}` (полный remount)
- [ ] Thumb-first изображения в списках, full на карточке
- [ ] Виртуализация списка б/у > 48 позиций
- [ ] `apiClient.js` — retry 502/503/504, outage guard для гостя
- [ ] Баннер ошибки каталога + «Повторить загрузку»

**На сервере:**
- [ ] После build — проверить наличие prefetch/chunks в `main.*.js` / отдельных chunks

### Деплой пользователя

```bash
update
```

### Критерии готовности

- [ ] LCP `/autoparts/used` < 2.5 s (или улучшение vs baseline этапа 2)
- [ ] Клик в карточку — контент < 2 s
- [ ] Гость видит каталог без 504 (с retry при кратковременном сбое)

### Команда для Plan mode

```
Этап 5 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 6 — Gunicorn + несколько workers

**Цель:** убрать узкое горлышко одного uvicorn-процесса.

### Задачи агента

**В репозитории:**
- [ ] `gunicorn` в `requirements.txt`
- [ ] Unit-файл `kroan.service` (или документ `docs/ops/kroan.service.example`):
  ```ini
  ExecStart=.../gunicorn app.main:app -k uvicorn.workers.UvicornWorker -w 3 -b 127.0.0.1:8080
  ```
- [ ] APScheduler / фоновые job — **только один** процесс (Celery beat или флаг `RUN_SCHEDULER=1` на одном worker)
- [ ] In-memory кэш → Redis (если есть)

**На сервере:**
- [ ] Установить unit, один рестарт
- [ ] WebSocket `/ws/` — проверить sticky или отдельный location
- [ ] RAM: 3 workers × ~300–500 MB — убедиться, что хватает 3.8 GB (или уменьшить `-w 2`)

### Деплой пользователя

```bash
update
# + ручное применение systemd unit, если не в репо:
systemctl daemon-reload && systemctl restart kroan
```

### Критерии готовности

- [ ] `ps aux | grep gunicorn` — 3 worker + master
- [ ] Параллельные запросы catalog + cart не дают 504 при умеренной нагрузке
- [ ] Scheduler не дублируется в каждом worker

### Команда для Plan mode

```
Этап 6 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 7 — PostgreSQL + PgBouncer + rate limits

**Цель:** выдержать много одновременных соединений и тяжёлые запросы каталога.

### Задачи агента

**На сервере:**
- [x] `EXPLAIN ANALYZE` типичного запроса каталога
- [x] Индексы (patch при старте или миграция):
  - `products (quantity, is_new, id DESC) WHERE quantity > 0`
  - `products (organization_id, quantity)`, `(part_type_id, quantity)`
- [x] PgBouncer (transaction mode), `DATABASE_URL` через порт 6432
- [x] Тюнинг PostgreSQL: `shared_buffers`, `effective_cache_size` (осторожно на 4 GB RAM)

**В репозитории:**
- [x] `docs/nginx/http-ddos-limits.conf` — пересмотреть `sg_api` burst для легитимного трафика
- [x] Документировать лимиты в `docs/ops/ddos-protection.md`

### Деплой пользователя

```bash
update --nginx   # если менялись лимиты
update           # если менялся backend pool
```

### Критерии готовности

- [x] p95 catalog query < 300 ms на cache miss
- [x] Нет `too many connections` в логах PostgreSQL
- [x] Активный пользователь не упирается в rate limit без причины

### Команда для Plan mode

```
Этап 7 из docs/ops/scale-and-speed-plan.md
```

---
## Этап 8 — Мониторинг и алерты

**Цель:** заметить деградацию (502/504, рестарты, нагрузка) до жалоб пользователей.

### Задачи агента

**На сервере:**
- [x] `scripts/ops/health-monitor.sh` — cron каждые 5 мин
- [x] Алерты: 502/504 > 5 за 5 мин, restart `kroan` > 2 за 15 мин, сервис down
- [x] fail2ban `nginx-req-limit` (429/503)
- [x] Логи: `/var/log/autoparts-health.log`, `/var/log/autoparts-alerts.log`

**В репозитории:**
- [x] Расширить `/api/admin/server-stats` — 502/504, рестарты, PgBouncer
- [x] `docs/ops/monitoring.md`, `docs/ops/monitor.env.example`
- [x] `ensure_monitoring()` в `update.sh`

### Деплой пользователя

```bash
update
```

### Критерии готовности

- [x] cron `health-monitor` active
- [x] Алерт пишется в `/var/log/autoparts-alerts.log`
- [x] Админка показывает 502/504 и рестарты kroan

### Команда для Plan mode

```
Этап 8 из docs/ops/scale-and-speed-plan.md
```

---

## Этап 9 — Нагрузочное тестирование и горизонталь

**Цель:** понять предел текущей архитектуры и план роста до 10k+ онлайн.

### Задачи агента

**Инструменты:**
- [ ] k6 или `ab` сценарий: 50–200 одновременных GET catalog + part-types
- [ ] Зафиксировать RPS и p95 latency до отказа
- [ ] План масштабирования: 2-й API VPS, read replica PostgreSQL, CDN для `/static` и `/uploads`

**В репозитории:**
- [ ] `docs/ops/load-test.md` — сценарий и результаты
- [ ] Обновить этот план секцией «Рекомендации после теста»

### Деплой пользователя

```bash
# После тюнинга по результатам теста:
update --nginx
update
```

### Критерии готовности

- [ ] Выдерживает целевой RPS (например 100 RPS на catalog с microcache) без 504
- [ ] Документирован следующий шаг (RAM upgrade / 2-й сервер / CDN)

### Команда для Plan mode

```
Этап 9 из docs/ops/scale-and-speed-plan.md
```

---

## Прогресс (заполняется по мере этапов)

| Этап | Статус | Дата | Заметки |
|------|--------|------|---------|
| 1 Стабильность | **выполнено** | 2026-07-05 | update `0dc458f`, verify 200/200/200/200, API за 8s |
| 2 Baseline | **выполнено** | 2026-07-05 | TTFB API 19–57ms, HTML 7–8ms, main.js 725KiB, PSI links в performance.md |
| 3 Nginx | **выполнено** | 2026-07-05 | prerender cache 15m, Brotli br, catalog HIT |
| 4 Backend | **выполнено** | 2026-07-05 | heavy jobs → Celery, USE_CELERY=true, thin scheduler |
| 5 Frontend | **выполнено** | 2026-07-05 | lazy chunks, prefetch, virtual list, retry 502/504 |
| 6 Gunicorn | **выполнено** | 2026-07-05 | 2 workers, scheduler Redis lock, WS pub/sub |
| 7 PostgreSQL | **выполнено** | 2026-07-05 | PgBouncer 6432, indexes, sg_api 50r/s |
| 8 Мониторинг | **выполнено** | 2026-07-05 | health-monitor cron, fail2ban, server-stats ops |
| 9 Load test | | | |

**502/504 baseline (до этапа 1):** 502 = 2, 504 = 302

**После этапа 1 (2026-07-05 14:54 MSK):**
- `update` завершён без ошибок; `bash -n /usr/local/bin/update` — OK
- Smoke: cart=200, part-types=200, catalog=200 (local + public)
- Публичный API: part-types 54ms, catalog 46ms
- `.env` 600/fast, пробелов нет; `vehicle_pictures` — OK; dotenv warnings за 1 ч — 0
- Один рестарт `kroan` за деплой (API готов за 8s)
- Рестартов за 24 ч до этапа: 20 → снижение ожидается при правиле «один update за раз»

**Критерии этапа 1:** все выполнены. Следующий шаг — **этап 2** (baseline LCP/TTFB).

**После этапа 2 (2026-07-05):**
- Baseline записан в [performance.md](./performance.md): TTFB API 19–57 ms, HTML 7–8 ms, `main.b584bc6a.js` 725 KiB
- 502/504 без изменений в текущем log (2 / 302); рестартов kroan/24h: 21 (+1 от update этапа 1)
- LCP/INP/CLS: ссылки PSI в performance.md (API 429 — lab-значения снять вручную или из Метрики)
- Скрипт повторного снятия: `scripts/ops/baseline-metrics.sh`

**Критерии этапа 2:** выполнены. Следующий шаг — **этап 3** (nginx Brotli, prerender cache).

**После этапа 3 (2026-07-05 15:08 MSK):**
- `update --nginx` → коммит `148bec3`, `nginx -t` OK
- Prerender: кэш `sg_prerender` TTL 15 мин, `proxy_read_timeout` 120 s
- Microcache: catalog/part-types `X-Cache-Status: HIT`
- Brotli: модули установлены, `content-encoding: br` на main.js
- Следующий шаг — **этап 4** (Celery, sitemap вне uvicorn)

**После этапа 4 (2026-07-05):**
- Тяжёлые scheduler job'ы (SEO, sitemap, seed, TecDoc) → Celery через thin APScheduler ticks
- Sitemap warm-up при старте → Celery `countdown=60`, не блокирует uvicorn
- `NEW_PARTS_SEO_SYNC_USE_CELERY=true` на prod (`ensure_scheduler_env` в update)
- Поиск: Redis cache 120 с на `/search`, `/resolve`, `/search-combined`; инвалидация в stock_ins

**После этапа 5 (2026-07-05):**
- Lazy chunks: `UsedPartsList`, `NewPartsResults` в `AutoParts.jsx`; prefetch в `9435.*.chunk.js`
- Карточки: мгновенный `Link` для новых запчастей; prefetch JS+API на hover/touch для б/у
- `MainLayout`: без `key={pathname}` remount; виртуализация списка б/у >48 (`@tanstack/react-virtual`)
- `apiClient`: retry 502/503/504 + outage guard; баннер «Повторить загрузку» в каталоге
- Smoke: HTML `/autoparts/used` TTFB ~9 ms; catalog HIT ~7 ms; product API HIT ~8 ms
- Следующий шаг — **этап 6** (Gunicorn workers)

**После этапа 6 (2026-07-05):**
- `kroan` → Gunicorn + 2 `UvicornWorker` (`docs/ops/kroan.service`)
- APScheduler только на leader worker (Redis lock `scheduler:leader`)
- DB pool: 10+10 на worker (вместо 50+50)
- WebSocket чат: Redis pub/sub `ws:push` + глобальный online-счётчик
- Следующий шаг — **этап 7** (PgBouncer, индексы)

**После этапа 7 (2026-07-05):**
- PgBouncer transaction pool на `127.0.0.1:6432`; `DATABASE_URL` через 6432, `DATABASE_URL_DIRECT` для pg_dump
- SQLAlchemy `NullPool` при PgBouncer (порт 6432); индексы каталога (`ensure_public_catalog_indexes`)
- PostgreSQL tuning `tuning-4gb.conf`; nginx `sg_api` 50 r/s (burst 60)
- Smoke: catalog miss p95 **~11 ms** (10 samples), EXPLAIN execution **0.57 ms**, `too many connections` — 0
- Hotfix `2bae84a`: убран `prepare_threshold` (psycopg3-only), kroan стабилен
- Следующий шаг — **этап 8** (мониторинг и алерты)

**После этапа 8 (2026-07-05):**
- `health-monitor.sh` в cron каждые 5 мин; алерты в `/var/log/autoparts-alerts.log`
- fail2ban `nginx-req-limit`; опционально Telegram через `/etc/autoparts/monitor.env`
- Админка server-stats: 502/504 за 15 мин, рестарты kroan за 24 ч, PgBouncer health
- Smoke: cron active, fail2ban jail active, API 200/200/200/200; hotfix `deedf1f` RAM в health-monitor
- Следующий шаг — **этап 9** (load test)

**Дополнительно (аудит 2026-07-05, до update):**
- Все сервисы active; git на сервере: `9d861d84`
- `vehicle_pictures` и nginx cache dirs — созданы
- `.env` без пробелов вокруг `=` (кроме закомментированных строк)
- Microcache работает: catalog `X-Cache-Status: MISS` → `HIT`
- `kroan` рестартов за 24 ч: **20** (цель этапа 1: ≤1/сутки после стабилизации)
- APScheduler (Yandex feed + Rossko SEO) может блокировать API **до ~3 мин** каждые 5 мин — исправляется на **этапе 4**

---

## Ссылки

- [Аудит сервера 2026-07-04](./server-audit-2026-07-04.md)
- [Производительность](./performance.md)
- [DDoS / rate limits](./ddos-protection.md)
- [Мониторинг и алерты](./monitoring.md)
- Nginx: `docs/nginx/svoygarage.conf`, `docs/nginx/http-microcache.conf`
- Деплой: `scripts/deploy/update.sh`

---

## Безопасность

- SSH: перейти на ключи, отключить password auth
- Сменить root-пароль после работ в чате
- `.env` — права `600`, владелец `fast`
