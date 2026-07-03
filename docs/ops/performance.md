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

## Baseline метрик (этап 0)

Зафиксировать «до/после» для:

| URL | LCP | TTFB |
|-----|-----|------|
| `/` | | |
| `/autoparts/used` | | |
| `/autoparts/new` | | |
| карточка `/part/...` | | |

```bash
curl -sI -H 'Accept-Encoding: gzip' https://svoygarage.ru/static/js/main.*.js
curl -sI 'https://svoygarage.ru/server/api/catalog/products?page=1&page_size=20'
```

## Деплой (кратко)

1. Backend: перезапуск uvicorn (schema patch создаст индексы при старте).
2. `npm run build` в `frontend/my-autoparts`, выкладка в `/var/www/my-autoparts`.
3. Nginx: microcache + Brotli по инструкции выше (можно без деплоя кода).
4. Smoke: `/autoparts/used` (скролл, превью), `/find?q=...`, вход в кабинет, возврат на склад.

## Prod: фоновые задачи

- `NEW_PARTS_SEO_SYNC_USE_CELERY=true` — SEO sync вне uvicorn process.
- Sitemap rebuild — только Celery/cron.
