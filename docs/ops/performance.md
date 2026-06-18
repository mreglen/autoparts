# Производительность (svoygarage.ru)

## Бэкенд

- Публичный каталог: `GET /api/catalog/products` — пагинация `page` / `page_size`.
- `GET /api/products/public/` — пагинированный ответ `{ items, total, page, page_size }`, Redis-кэш по ключу `products:public:p{N}:s{M}:loc:{id|all}`.
- Кабинет продавца обновляет остатки через `GET /api/products/` (`fetchMyProducts`), не через публичный каталог.

## Фронтенд

- Длинные списки б/у запчастей: виртуализация в `UsedPartsList` при >48 позиций (`@tanstack/react-virtual`).
- Code splitting: главная и `/autoparts/*` — eager; About, landing, карточка товара — lazy.
- Шрифт Onest и лого — preload/preconnect в `public/index.html`.
- Core Web Vitals отправляются в Яндекс.Метрику (`reportWebVitals.js`): параметры `web_vitals_lcp`, `web_vitals_inp`, `web_vitals_cls` и цели `cwv_*`.

### Где смотреть CWV в Метрике

1. **Параметры визитов** — отчёты с срезом по `web_vitals_*` (после накопления данных).
2. **Цели** — `cwv_lcp`, `cwv_inp`, `cwv_cls`.
3. **Скорость загрузки** — стандартные отчёты Метрики по страницам.

`webvisor: false` в счётчике снижает нагрузку на main thread (INP).

## Nginx: Brotli

Перед деплоем [`docs/nginx/svoygarage.conf`](../nginx/svoygarage.conf):

```bash
nginx -V 2>&1 | grep -i brotli
```

Если модуль **есть** — в конфиге уже включены `brotli on` и `brotli_types`. Проверка:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -sI -H 'Accept-Encoding: br' https://svoygarage.ru/static/js/main.js | grep -i content-encoding
```

Если модуль **отсутствует** (проверено на prod: `nginx -V 2>&1 | grep -i brotli` — пусто):

```bash
sudo apt install libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
# или сборка ngx_brotli — см. https://github.com/google/ngx_brotli
```

До установки модуля закомментируйте директивы `brotli` в `svoygarage.conf`, иначе `nginx -t` завершится ошибкой. Gzip остаётся fallback.

## Деплой (кратко)

1. Backend + миграции не требуются для perf-изменений API.
2. `npm run build` в `frontend/my-autoparts`, выкладка в `/var/www/my-autoparts`.
3. Обновить nginx-конфиг при включении Brotli.
4. Smoke: `/autoparts/used` (скролл, подгрузка), возврат со склада в кабинете.
