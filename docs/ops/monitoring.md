# Мониторинг production — svoygarage.ru

Этап 8 плана масштабирования: заметить деградацию до жалоб пользователей.

## Компоненты

| Компонент | Назначение |
|-----------|------------|
| `scripts/ops/health-monitor.sh` | cron каждые 5 мин: сервисы, 502/504, рестарты kroan, load/RAM/диск |
| `/var/log/autoparts-health.log` | История проверок (OK / ISSUES) |
| `/var/log/autoparts-alerts.log` | Срабатывания алертов |
| `/etc/autoparts/monitor.env` | Пороги и опционально Telegram |
| Админка → **Сервер** | `/api/admin/server-stats` — live CPU/RAM + операционные метрики |
| fail2ban `nginx-req-limit` | Бан IP при частых 429/503 |
| `@svoygarage_bot` (alert-bot) | Telegram-бот: алерты + история ошибок (только admin) |

## Пороги по умолчанию

| Метрика | Порог | Окно |
|---------|-------|------|
| nginx 502 | > 5 | 5 мин |
| nginx 504 | > 5 | 5 мин |
| restart `kroan` | > 2 | 15 мин |
| load average 1m | > 4 | момент |
| RAM | > 90% | момент |
| диск `/` | > 90% | момент |

Повторный алерт по той же причине — не чаще чем раз в **30 мин** (`ALERT_COOLDOWN_MIN`).

## Установка (автоматически через `update`)

`ensure_monitoring()` в `scripts/deploy/update.sh`:

- cron: `*/5 * * * * root …/health-monitor.sh`
- шаблон `/etc/autoparts/monitor.env` (если файла ещё нет)
- fail2ban filter/jail (если установлен `fail2ban`)

## Telegram alert-bot

Бот `@svoygarage_bot` — основной канал алертов для администраторов.

**Авторизация:** `/start` → email администратора → пароль (только `is_admin`).

**Функции:**
- push-уведомления об ошибках (nginx, kroan, celery, health-monitor)
- кнопка «История ошибок» с пагинацией
- кнопка «Статус» — состояние сервисов

**Установка (автоматически через `update`):**
- venv и systemd unit `alert-bot`
- env: `/etc/autoparts/alert-bot.env`

```bash
sudo nano /etc/autoparts/alert-bot.env   # BOT_TOKEN (DATABASE_URL подставляется из backend/.env)
sudo chmod 600 /etc/autoparts/alert-bot.env
sudo systemctl restart alert-bot
journalctl -u alert-bot -f
```

**Тестовый алерт:**

```bash
/home/fast/autoparts/alert-bot/venv/bin/python \
  /home/fast/autoparts/alert-bot/scripts/ingest_alert.py \
  --source test --key manual --severity info --title test --message "Deploy OK"
```

`health-monitor.sh` при наличии alert-bot отправляет алерты через `ingest_alert.py` (fallback — старый `TELEGRAM_CHAT_ID` в monitor.env).

## Telegram (legacy, опционально)

```bash
sudo cp docs/ops/monitor.env.example /etc/autoparts/monitor.env
sudo nano /etc/autoparts/monitor.env   # TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
sudo chmod 600 /etc/autoparts/monitor.env
```

## Ручная проверка

```bash
# Однократный прогон
sudo bash /home/fast/autoparts/scripts/ops/health-monitor.sh

# Логи
tail -20 /var/log/autoparts-health.log
tail -20 /var/log/autoparts-alerts.log

# Baseline (этап 2)
bash /home/fast/autoparts/scripts/ops/baseline-metrics.sh
```

## Админка

Раздел **Админ → Сервер** показывает:

- предупреждения CPU/RAM/диск/load
- **502/504** за 15 мин (nginx access log)
- **рестарты kroan** за 24 ч
- health: PostgreSQL, Redis, Celery, **PgBouncer**

## fail2ban

Конфиги в `docs/ops/fail2ban/`. После `update` копируются в `/etc/fail2ban/`.

```bash
sudo fail2ban-client status nginx-req-limit
```

## Связанные документы

- [DDoS / rate limits](./ddos-protection.md)
- [Производительность](./performance.md)
- [План масштабирования](./scale-and-speed-plan.md)
