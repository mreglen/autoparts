# Nginx: HTTP 404 для SPA на svoygarage.ru

React отдаёт `index.html` с кодом **200** для любого URL (`try_files ... /index.html`). Яндекс индексирует несуществующие страницы как живые.

Решение: перед отдачей SPA nginx спрашивает backend через `auth_request`.

## 1. Backend (уже в коде)

```text
GET http://127.0.0.1:8080/api/public/page-check?path=/requested/path
```

| Код | Значение |
|-----|----------|
| **204** | страница есть → отдаём `index.html` |
| **404** | страницы нет → отдаём `404.html` с кодом 404 |

Проверка на сервере (после деплоя backend):

```bash
curl -i "http://127.0.0.1:8080/api/public/page-check?path=/kugbkkrfck"
curl -i "http://127.0.0.1:8080/api/public/page-check?path=/delivery"
curl -i "http://127.0.0.1:8080/api/public/page-check?path=/part/999999999-test-test"
```

## 2. Frontend

Файл `frontend/my-autoparts/public/404.html` должен попасть в `/var/www/my-autoparts/404.html` после `npm run build` и деплоя.

```bash
ls -la /var/www/my-autoparts/404.html
```

## 3. Патч для `/etc/nginx/sites-available/svoygarage`

В блоке `server { ... server_name svoygarage.ru; ... }` **замените** текущий SPA-блок:

```nginx
    # React Frontend (SPA)
    location / {
        root /var/www/my-autoparts;
        try_files $uri $uri/ /index.html;
    }
```

**На:**

```nginx
    # Проверка SPA-URL через backend (HTTP 404 для несуществующих страниц)
    location = /_internal/page-check {
        internal;
        proxy_pass http://127.0.0.1:8080/api/public/page-check?path=$request_uri;
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
    }

    # React Frontend (SPA)
    location / {
        root /var/www/my-autoparts;
        try_files $uri $uri/ @spa;
    }

    location @spa {
        auth_request /_internal/page-check;
        error_page 404 =404 /404.html;
        root /var/www/my-autoparts;
        try_files /index.html =404;
    }

    location = /404.html {
        root /var/www/my-autoparts;
        internal;
    }
```

Блок со статикой **оставьте как есть** (он должен идти сразу после):

```nginx
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        root /var/www/my-autoparts;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
```

Остальные `location` (`/server/api/`, `/server/ws/`, uploads и т.д.) **не меняйте**.

### Как это работает

```text
GET /kugbkkrfck
  → try_files: файла нет
  → @spa → auth_request → backend 404
  → nginx отдаёт /404.html с HTTP 404

GET /delivery
  → try_files: файла нет
  → @spa → auth_request → backend 204
  → nginx отдаёт /index.html с HTTP 200

GET /robots.txt
  → try_files: файл есть → отдаётся напрямую

GET /part/123-brand-article (товар удалён)
  → @spa → backend 404 → HTTP 404
```

## 4. Применение на сервере

```bash
# 1. Задеплойте backend с endpoint /api/public/page-check
# 2. Задеплойте frontend (с 404.html в build)

sudo nginx -t
sudo systemctl reload nginx

curl -I https://svoygarage.ru/kugbkkrfck
curl -I https://svoygarage.ru/delivery
curl -I https://svoygarage.ru/robots.txt
```

Ожидается:

| URL | HTTP |
|-----|------|
| `/kugbkkrfck` | **404** |
| `/delivery` | **200** |
| `/robots.txt` | **200** |
| `/part/{несуществующий-id}` | **404** |

## 5. Яндекс.Вебмастер

**Индексирование → Проверка страницы** → `https://svoygarage.ru/kugbkkrfck` → код **404**.

`robots.txt` не может запретить случайные URL вроде `/kugbkkrfck` — нужен именно HTTP 404 на сервере.

## 6. Если auth_request не срабатывает

Проверьте логи:

```bash
sudo tail -f /var/log/nginx/svoygarage_ssl_error.log
curl -i "http://127.0.0.1:8080/api/public/page-check?path=/kugbkkrfck"
```

Если backend ещё не задеплоен, nginx будет отдавать **500** на все SPA-URL — сначала обновите backend, потом nginx.

## 7. Блок server по IP (195.24.65.251)

В вашем конфиге второй `server` без фронтенда — для IP это нормально. HTTP 404 для сайта настраивается только в блоке `server_name svoygarage.ru`.
