# Защита от DDoS — Свой Гараж

Многослойная защита на nginx и FastAPI (без Cloudflare).

## Слои

1. **nginx** — `limit_req`, `limit_conn`, закрытие прямого prerender, таймауты
2. **FastAPI middleware** — Redis rate limit по путям
3. **Internal token** — prerender/page-check только из nginx internal
4. **Redis-кэш** — `GET /api/products/public/`
5. **WebSocket** — не более 5 соединений на пользователя

## Деплой nginx

```bash
sudo cp docs/nginx/http-ddos-limits.conf /etc/nginx/snippets/svoygarage-ddos-limits.conf
sudo cp docs/nginx/svoygarage-secrets.conf.example /etc/nginx/snippets/svoygarage-secrets.conf
# Отредактировать токен в svoygarage-secrets.conf (chmod 600)
```

В `/etc/nginx/nginx.conf` в блоке `http {}`:

```nginx
include /etc/nginx/snippets/svoygarage-bot-map.conf;
include /etc/nginx/snippets/svoygarage-ddos-limits.conf;
include /etc/nginx/snippets/svoygarage-secrets.conf;
```

Скопировать `docs/nginx/svoygarage.conf` на сервер и:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Backend .env

```env
PRERENDER_INTERNAL_TOKEN=<тот же токен, что в svoygarage-secrets.conf>
RATE_LIMIT_ENABLED=true
PRODUCTS_PUBLIC_CACHE_TTL_SECONDS=45
WEBSOCKET_MAX_CONNECTIONS_PER_USER=5
```

Для локальной разработки `PRERENDER_INTERNAL_TOKEN` можно не задавать — проверка prerender отключена.

## Лимиты (по умолчанию)

| Путь | Лимит |
|------|-------|
| `/api/auth/login` | 10 / 15 мин / IP |
| `/api/auth/register*`, `password*`, `seller/register` | 5 / час / IP |
| `/api/public/part-meta`, `new-part-meta` | 60 / мин / IP |
| `/api/products/public/` | 20 / мин / IP |
| `/api/public/analytics/events` | 120 / мин / IP |
| Остальной `/api/` | 300 / мин / IP |

nginx дополнительно (этап 7, 2026-07-05): **50 req/s** на API (`sg_api`, burst 60), 5 req/min на auth, 10 conn/IP на WebSocket.

Публичный каталог (`/server/api/catalog/`, `/products/public/`) использует microcache nginx — лимит 50 r/s + burst 60 достаточен для активного просмотра без 429.

## PostgreSQL и PgBouncer (этап 7)

| Компонент | Значение |
|-----------|----------|
| PgBouncer | `127.0.0.1:6432`, `pool_mode=transaction` |
| `DATABASE_URL` | порт **6432** (через PgBouncer) |
| `DATABASE_URL_DIRECT` | порт 5432 (бэкапы, `pg_dump`, EXPLAIN) |
| SQLAlchemy | `NullPool` при `:6432` (psycopg2) |
| Индексы | `ix_products_public_catalog`, `ix_products_org_qty`, `ix_products_part_type_qty` |

Тюнинг PostgreSQL (4 GB RAM): `docs/postgresql/tuning-4gb.conf` → `conf.d/99-autoparts-tuning.conf`.

Скрипты на сервере: `scripts/ops/catalog-explain.sh`, `scripts/ops/catalog-latency.sh`.

## UFW

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## fail2ban (пример)

`/etc/fail2ban/jail.d/nginx-req-limit.conf`:

```ini
[nginx-req-limit]
enabled = true
filter = nginx-req-limit
logpath = /var/log/nginx/svoygarage_ssl_access.log
maxretry = 30
findtime = 60
bantime = 3600
```

Фильтр `/etc/fail2ban/filter.d/nginx-req-limit.conf`:

```ini
[Definition]
failregex = ^<HOST> -.*"(GET|POST|HEAD).*" (429|503)
ignoreregex =
```

## При атаке

1. Проверить `htop`, логи nginx (`429`, `503`), Redis, PostgreSQL connections
2. Временно ужесточить `rate` в `svoygarage-ddos-limits.conf` и reload nginx
3. Заблокировать IP: `deny 1.2.3.4;` в server block
4. У хостера — запросить anti-DDoS на канале (L3/L4)

## Мониторинг

Админка: server stats (`/api/admin/server-stats`) — CPU, RAM, Redis, Celery, PgBouncer, 502/504, рестарты kroan.

Cron: `scripts/ops/health-monitor.sh` каждые 5 мин — алерты при load > 4, 502/504 > 5 за 5 мин, рестартах kroan.

Подробнее: [monitoring.md](./monitoring.md).

## Ограничения

Без Cloudflare объёмные L3/L4-атаки (гигабиты) не останавливаются на уровне приложения — только у провайдера.
