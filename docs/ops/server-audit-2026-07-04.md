# Аудит production-сервера svoygarage.ru

**Дата:** 2026-07-04, ~20:47 MSK  
**Сервер:** `vm2512296768` (`195.24.65.251`)  
**Метод:** SSH (read-only), логи systemd/nginx, локальные curl-проверки  
**Код проекта на сервере не менялся** — только сбор фактов.

---

## Краткий вывод

Сейчас сервисы **работают**: `kroan`, `nginx`, `postgresql`, `redis`, `celery` — active.  
API через nginx отвечает быстро (profile 401, cart 200, analytics POST 422 — нормально для тестов без токена/тела).

Основные проблемы пользователей (**502 / ERR_CONNECTION_REFUSED / долгая загрузка**) — следствие **частых перезапусков `kroan`** (~12 за сутки) и **окна недоступности ~8–12 с** на каждый рестарт (пока uvicorn поднимается и прогревает sitemap-кэши). Это не баг фронтенда.

---

## Состояние сервисов

| Сервис | Статус | Комментарий |
|--------|--------|-------------|
| `kroan.service` | active | uvicorn `127.0.0.1:8080`, один процесс |
| `nginx` | active | config test OK |
| `postgresql@16-main` | active | |
| `redis-server` | active | celery подключён |
| `celery` | active | concurrency 2 (solo) |

**Ресурсы:** RAM 3.8 GiB (свободно ~1.5 GiB), диск `/` 35% (21G/60G), load ~0.6–0.8.

---

## Ошибки из браузерной консоли (объяснение)

| Сообщение | Причина |
|-----------|---------|
| `cart` — **ERR_CONNECTION_REFUSED** | nginx не смог подключиться к `:8080` — uvicorn был остановлен (рестарт) |
| `analytics/events` — **502** | то же: `connect() failed (111: Connection refused)` в nginx error log |
| `runtime.lastError: Receiving end does not exist` | расширение Chrome, **не сайт** — можно игнорировать |

Пример из nginx (`20:45:52`):
```
connect() failed (111: Connection refused) while connecting to upstream
upstream: "http://127.0.0.1:8080/api/cart/"
```

За текущий лог-файл: **152 × 502**, **220 × 504** на `svoygarage_ssl_access.log`.

---

## Проблема 1 — частые рестарты backend (критично для UX)

**Факт:** за 24 ч — **12 остановок** `kroan.service`.  
Рестарты совпадают с 502 в nginx (окно ~8–12 с до `Application startup complete`).

**Типичная последовательность при рестарте:**
1. uvicorn останавливается → порт 8080 закрыт → **502 / connection refused**
2. schema_patches (~1–2 с)
3. sitemap warm-up (~3–4 с, ~31k URL new-parts)
4. `Application startup complete` → API снова доступен

**Рекомендации (конфиг/ops, не код):**
- Не перезапускать `kroan` подряд несколько раз подряд (было 2 рестарта за 11 с в 19:59).
- Деплоить в окно низкой нагрузки; после `git pull` — **один** `systemctl restart kroan`.
- Рассмотреть **graceful deploy**: healthcheck + ожидание готовности перед reload nginx.
- Рассмотреть **2+ worker** (gunicorn + uvicorn workers) или вынести тяжёлый sitemap warm-up из blocking startup (отдельная задача в коде — см. ниже).

---

## Проблема 2 — 500 на `/api/products/?sort=date_desc` (исправлено на сервере)

**Лог (19:41):**
```
AttributeError: type object 'Product' has no attribute 'created_at'
GET /api/products/?page=1&page_size=30&sort=date_desc → 500
```

Ломало вкладку **«Мои запчасти» → В наличии**.

**Текущее состояние на сервере:** в `products.py` сортировка уже по `Product.id` (фикс задеплоен). Новых 500 по этой причине после ~20:42 не видно.

**Проверить после деплоя:** открыть `/my-parts`, убедиться что список грузится без 500.

---

## Проблема 3 — 504 upstream timed out

**Причины из nginx error log:**
- таймаут prerender-эндпоинтов (`new-part-prerender`, `part-prerender`, `page-prerender`) — боты Google/Yandex;
- таймаут API во время высокой нагрузки / рестарта (например analytics в 20:41).

**Рекомендации:**
- Убедиться, что prerender-страницы кэшируются nginx (если ещё нет — настроить `proxy_cache` для `/api/public/*-prerender`).
- Для SEO-ботов можно увеличить `proxy_read_timeout` только на prerender location (сейчас 60s в конфиге — при блокировке worker'а этого мало).
- Мониторить, не блокирует ли один uvicorn-worker долгие prerender + sitemap rebuild одновременно.

---

## Проблема 4 — `.env` на сервере (конфиг)

### 4.1 Комментарий без `#` — **исправлено**
Строка `# SEO Rossko sync` на сервере уже с `#`.  
Ранее было `SEO Rossko sync` → **110 предупреждений** `python-dotenv could not parse statement starting at line 66` за сутки.

### 4.2 Пробелы вокруг `=` (ещё не исправлено)
Строки с пробелами (python-dotenv может читать некорректно):
```
ACCESS_TOKEN_EXPIRE_MINUTES = 525600
PUBLIC_BASE_URL = 'https://svoygarage.ru/server'
BASE_URL = 'https://svoygarage.ru/server/'
```

**Исправить на сервере** (только `.env`):
```env
ACCESS_TOKEN_EXPIRE_MINUTES=525600
PUBLIC_BASE_URL=https://svoygarage.ru/server
BASE_URL=https://svoygarage.ru/server/
```
Без кавычек и без пробелов вокруг `=`. После правки — один рестарт `kroan`.

---

## Проблема 5 — отсутствует каталог uploads

**Лог при каждом старте:**
```
ERROR:app.main:Каталог vehicle_pictures не найден:
/home/fast/autoparts/backend/uploads/vehicle_pictures
```

**Исправление (ops):**
```bash
mkdir -p /home/fast/autoparts/backend/uploads/vehicle_pictures
chown -R fast:fast /home/fast/autoparts/backend/uploads
```

---

## Проблема 6 — schema_patches на каждом рестарте

При **каждом** запуске в логах повторяется:
```
Applied users.public_code column patch
Applied rossko_settings row defaults patch
Applied YooKassa payment tables patch
```

Патчи, похоже, идempotent, но:
- засоряют логи;
- возможно, патчи не записывают факт применения в БД.

**Рекомендация (код, отдельная задача):** доработать `schema_patches.py`, чтобы «Applied» писалось только при реальном изменении.

---

## Проблема 7 — nginx reload alerts

В `/var/log/nginx/error.log` многократно:
```
open socket #N left in connection
aborting
```
При `systemctl reload nginx` — типичное предупреждение при активных keep-alive. Не критично, но лучше использовать `nginx -t && systemctl reload nginx` без частых reload подряд.

---

## Проблема 8 — rate limit API

Пример:
```
limiting requests, excess: 60.920 by zone "sg_api"
```
Клиент `178.211.167.147` упирался в лимит `/server/api/`. Для активного пользователя/админки может выглядеть как «тормоза».

**Рекомендация:** проверить настройки `sg_api` в `/etc/nginx/snippets/svoygarage-ddos-limits.conf` — возможно, увеличить burst для авторизованных или whitelist office IP.

---

## Деплой: что на сервере vs локально

| Компонент | На сервере | Статус |
|-----------|------------|--------|
| Backend git | `32ab7b9a` branch `celery_update` | |
| `product_drafts` router | есть | |
| Таблица `product_drafts` | есть в PostgreSQL | |
| Fix sort `created_at` → `id` | задеплоен | |
| `total_quantity` / `total_value` в `/api/products/` | задеплоен | |
| Frontend build | `/var/www/my-autoparts` обновлён 2026-07-04 20:45 | |
| `myProductsTotalQuantity` в JS bundle | найден в main.*.js | фикс статистики my-parts на фронте задеплоен |

**Git status на сервере:** много `D` для `__pycache__` — не критично, но лучше не коммитить pyc и добавить в `.gitignore` при деплое.

---

## `kroan.service` (текущий unit)

```ini
User=fast
WorkingDirectory=/home/fast/autoparts/backend
ExecStart=.../uvicorn app.main:app --host 127.0.0.1 --port 8080
Restart=on-failure
RestartSec=5
```

**Замечания:**
- один worker — все запросы + websocket + scheduler + startup sitemap в одном процессе;
- нет `ExecStartPre` healthcheck;
- нет dependency на postgresql (стартует параллельно).

---

## Чеклист действий (приоритет)

### Срочно (ops, без изменения кода)
1. [ ] Прекратить многократные рестарты подряд — один рестарт после деплоя.
2. [ ] Исправить пробелы в `/home/fast/autoparts/backend/.env` (см. §4.2).
3. [ ] Создать `uploads/vehicle_pictures` (§5).
4. [ ] После правок `.env` — один `systemctl restart kroan`, подождать ~15 с, проверить curl:
   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/cart/
   ```

### Средний приоритет (конфиг nginx)
5. [ ] Кэш prerender-ответов или отдельный timeout для bot/prerender location.
6. [ ] Пересмотреть rate limit `sg_api` для легитимного трафика.
7. [ ] Настроить мониторинг: alert на 502/504 > N за 5 мин, alert на restart kroan.

### Низкий приоритет (код — отдельные задачи)
8. [ ] Вынести sitemap warm-up из blocking startup (фоновая задача / celery).
9. [ ] Исправить schema_patches — не логировать «Applied» повторно.
10. [ ] `product_list_item.py` — проверить использование несуществующего `created_at` (если ещё есть).
11. [ ] Запустить `remigrate_user_public_codes.py` (лог каждый раз напоминает про public_code).

---

## Проверка «всё ок» после стабилизации

```bash
# на сервере
systemctl is-active kroan nginx postgresql redis-server celery
curl -s -o /dev/null -w 'local cart:%{http_code}\n' http://127.0.0.1:8080/api/cart/
curl -s -o /dev/null -w 'public cart:%{http_code}\n' https://svoygarage.ru/server/api/cart/
journalctl -u kroan -n 20 --no-pager | grep -E 'ERROR|startup complete'
grep -c ' 502 ' /var/log/nginx/svoygarage_ssl_access.log   # не должно расти после стабилизации
```

В браузере:
- `/my-parts` — список грузится, бейдж «617» = позиции, шапка — сумма **штук** по всем складам (не только первая страница).
- Перезагрузка в черновике — без 502 на `profile` / `cart`.

---

## Безопасность

- В отчёте **не дублируются** секреты из `.env`.
- SSH-пароль передавался в чате — **рекомендуется сменить** root-пароль и перейти на ключи (`PasswordAuthentication no`).
- `.env` на сервере содержит production-секреты (YooKassa, DaData, VAPID и т.д.) — права файла должны быть `600`, владелец `fast`.

---

*Отчёт сгенерирован по результатам read-only аудита. Изменений на сервере и в репозитории при аудите не вносилось.*
