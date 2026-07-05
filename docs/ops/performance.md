# Производительность (svoygarage.ru)

## Бэкенд

- Публичный каталог: `GET /api/catalog/products` — пагинация `page` / `page_size`, Redis-кэш (TTL ~60 с).
- `GET /api/products/public/` — пагинированный ответ `{ items, total, page, page_size }`, Redis-кэш по ключу `products:public:p{N}:s{M}:loc:{id|all}`.
- `GET /api/search-products/search` и `/resolve` — Redis-кэш 120 с (`search:*`).
- При create/update/delete товара, модерации, расходе/возврате склада — инвалидация `catalog:*`, `products:public:*`, `search:*` (`public_catalog_cache.py`).
- Индексы PostgreSQL на `products` (quantity, org, part_type) — patch `ensure_public_catalog_indexes()` при старте backend.
- Медленные запросы (>1 с) логируются middleware `SlowRequestLoggingMiddleware`.
- Кабинет продавца обновляет остатки через `GET /api/products/` (`fetchMyProducts`), не через публичный каталог.

## Фронтенд

- Списки б/у: превью **thumb-first** (`buildListImageUrlFallbackChain`); full — только на карточке товара.
- Длинные списки б/у: виртуализация в `UsedPartsList` при >48 позиций (`@tanstack/react-virtual`).
- `UsedPartsList` и `NewPartsResults` — lazy-load внутри `AutoParts` (отдельные chunks).
- `ProductCard`, `NewPartProductCard` — `React.memo`.
- Code splitting: главная и `/autoparts/*` — eager shell; About, landing, карточка товара — lazy.
- Шрифт Onest и лого — preload/preconnect в `public/index.html`.
- Core Web Vitals → Яндекс.Метрика (`reportWebVitals.js`): `web_vitals_lcp`, `web_vitals_inp`, `web_vitals_cls`, цели `cwv_*`.

### Где смотреть CWV в Метрике

1. **Параметры визитов** — срез по `web_vitals_*`.
2. **Цели** — `cwv_lcp`, `cwv_inp`, `cwv_cls`.
3. **Скорость загрузки** — стандартные отчёты Метрики по страницам.

`webvisor: false` в счётчике снижает нагрузку на main thread (INP).

## Nginx: microcache и Brotli

Конфиги в репозитории: [`docs/nginx/svoygarage.conf`](../nginx/svoygarage.conf), [`http-microcache.conf`](../nginx/http-microcache.conf), [`svoygarage-brotli.conf`](../nginx/svoygarage-brotli.conf).

### Microcache публичного API (рекомендуется)

```bash
# 1. Snippet в http {}
sudo cp docs/nginx/http-microcache.conf /etc/nginx/snippets/svoygarage-microcache.conf
# В nginx.conf внутри http { }:
#   include /etc/nginx/snippets/svoygarage-microcache.conf;

# 2. Каталог кэша
sudo mkdir -p /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check
sudo chown www-data:www-data /var/cache/nginx/sg_api /var/cache/nginx/sg_page_check

# 3. Обновить site config
sudo cp docs/nginx/svoygarage.conf /etc/nginx/sites-available/svoygarage
sudo nginx -t && sudo systemctl reload nginx

# 4. Проверка (второй запрос — HIT)
curl -sI 'https://svoygarage.ru/server/api/catalog/products?page=1&page_size=20' | grep -i x-cache-status
```

Microcache покрывает: `/server/api/catalog/`, `/products/public/`, `/public/part-meta`, `/public/new-part-meta`, sitemap; `/_internal/page-check` — 120 с.

### index.html и uploads

- `@spa` и `location = /index.html` — `Cache-Control: no-cache` (свежий SPA после деплоя).
- `/uploads/` и `/server/uploads/` — `max-age=2592000` **без** `immutable`.

### Brotli

```bash
nginx -V 2>&1 | grep -i brotli
```

Если модуль **есть**:

```bash
sudo cp docs/nginx/svoygarage-brotli.conf /etc/nginx/snippets/svoygarage-brotli.conf
# include в http {}
sudo nginx -t && sudo systemctl reload nginx
curl -sI -H 'Accept-Encoding: br' https://svoygarage.ru/static/js/main.js | grep -i content-encoding
```

Если модуль **отсутствует**:

```bash
sudo apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
```

До установки модуля не подключайте `svoygarage-brotli.conf` — `nginx -t` упадёт. Gzip остаётся fallback.

## Baseline метрик (этап 2, 2026-07-05)

Зафиксировано после этапа 1 стабилизации. Сравнивать с этими цифрами на этапах 3–5.

### Страницы (TTFB HTML + LCP)

| URL | LCP PSI mobile | INP | CLS | TTFB HTML | Примечание |
|-----|----------------|-----|-----|-----------|------------|
| `/` | [снять в PSI](https://pagespeed.web.dev/analysis?url=https://svoygarage.ru/) | — | — | 8 ms | SPA shell |
| `/autoparts/used` | [снять в PSI](https://pagespeed.web.dev/analysis?url=https://svoygarage.ru/autoparts/used) | — | — | 8 ms | + catalog API |
| `/autoparts/new` | [снять в PSI](https://pagespeed.web.dev/analysis?url=https://svoygarage.ru/autoparts/new) | — | — | 7 ms | лендинг |
| `/part/605-Jakoparts-J2883012` | [снять в PSI](https://pagespeed.web.dev/analysis?url=https://svoygarage.ru/part/605-Jakoparts-J2883012) | — | — | — | б/у карточка |
| `/autoparts/new/part/23216-Renault-288907815R` | [снять в PSI](https://pagespeed.web.dev/analysis?url=https://svoygarage.ru/autoparts/new/part/23216-Renault-288907815R) | — | — | — | новая карточка |

**LCP/INP/CLS (lab):** Google PSI API вернул `429 Too Many Requests` при автоматическом снятии. Значения LCP заполнить вручную по ссылкам PSI выше или из Яндекс.Метрики (`web_vitals_lcp`, `web_vitals_inp`, `web_vitals_cls` — см. `reportWebVitals.js`).

**Цели для сравнения:** LCP < 2.5 s, INP < 200 ms, CLS < 0.1.

### API TTFB (nginx + microcache, сервер 2026-07-05)

| Endpoint | TTFB | X-Cache-Status | Примечание |
|----------|------|----------------|------------|
| `GET /server/api/catalog/products?page=1&page_size=20` | 19 ms | HIT | повторный запрос |
| `GET /server/api/catalog/products?...&_bust=*` | 57 ms | HIT/MISS | первый с уникальным query |
| `GET /server/api/part-types/public` | 19 ms | — | |
| `GET /server/api/catalog/facets` | 35 ms | — | |

Прямой замер (этап 1): catalog ~46 ms, part-types ~54 ms с публичного HTTPS.

### Статика: main.js

| Файл | Raw | Gzip (wire) | Brotli |
|------|-----|-------------|--------|
| `main.b584bc6a.js` | 725 KiB (741 815 B) | ~725 KiB (nginx gzip без существенного сжатия на hashed static) | не установлен |

Проверка Brotli: `nginx -V | grep brotli` → модуль отсутствует (этап 3).

### Стабильность (nginx + systemd)

| Метрика | Этап 1 (до) | Этап 2 (2026-07-05) |
|---------|-------------|---------------------|
| 502 в `svoygarage_ssl_access.log` | 2 | 2 |
| 504 в `svoygarage_ssl_access.log` | 302 | 302 |
| Рестартов `kroan` / 24 ч | 20 | 21 |

Счётчик 502/504 в текущем log-файле (не rolling 24h). Для тренда — сравнивать после этапов 3–4.

### Команды для повторного снятия

Скрипт: [`scripts/ops/baseline-metrics.sh`](../../scripts/ops/baseline-metrics.sh) (запуск на сервере от root).

```bash
curl -s -o /dev/null -w 'catalog TTFB:%{time_starttransfer}s total:%{time_total}s\n' \
  -H 'Host: svoygarage.ru' \
  "https://127.0.0.1/server/api/catalog/products?page=1&page_size=20" -k
curl -sI -H 'Accept-Encoding: gzip' -H 'Host: svoygarage.ru' \
  https://127.0.0.1/static/js/main.b584bc6a.js -k | grep -iE 'content-length|content-encoding'
```

---

## Деплой (кратко)

1. Backend: перезапуск uvicorn (schema patch создаст индексы при старте).
2. `npm run build` в `frontend/my-autoparts`, выкладка в `/var/www/my-autoparts`.
3. Nginx: microcache + Brotli по инструкции выше (можно без деплоя кода).
4. Smoke: `/autoparts/used` (скролл, превью), `/find?q=...`, вход в кабинет, возврат на склад.

## Prod: фоновые задачи

- `NEW_PARTS_SEO_SYNC_USE_CELERY=true` — SEO sync вне uvicorn process.
- Sitemap rebuild — только Celery/cron.
