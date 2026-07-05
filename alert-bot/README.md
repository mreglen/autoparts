# SvoyGarage Telegram Alert Bot

Уведомления об ошибках сервера (nginx, kroan, celery, health-monitor) в Telegram.

## Локальный запуск

```bash
cd alert-bot
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # заполнить BOT_TOKEN и DATABASE_URL
python -m alert_bot.main
```

## Production

Устанавливается автоматически через `update`. Env: `/etc/autoparts/alert-bot.env`.

```bash
systemctl status tor alert-bot
journalctl -u alert-bot -f
```

Авторизация: `/start` в @svoygarage_bot → email администратора → пароль.

## Сеть: Telegram заблокирован на VPS

На многих российских VPS прямой доступ к `api.telegram.org` заблокирован (TCP timeout). Сайт и backend **не затрагиваются** — через Tor ходит только `alert-bot`.

| Компонент | Назначение |
|-----------|------------|
| `tor.service` | Локальный SOCKS5 на `127.0.0.1:9050` + obfs4-мосты |
| `TELEGRAM_PROXY_URL=socks5://127.0.0.1:9050` | Прокси для python-telegram-bot |
| [`docs/ops/torrc`](docs/ops/torrc) | Версионированный конфиг мостов (копируется в `/etc/tor/torrc`) |

### Обновление obfs4-мостов

Если Telegram перестал отвечать через Tor:

1. Получите новые мосты: https://bridges.torproject.org/bridges?transport=obfs4
2. Обновите [`docs/ops/torrc`](docs/ops/torrc) в репозитории
3. `git push` → на сервере `update`
4. Проверка: `curl --proxy socks5h://127.0.0.1:9050 https://api.telegram.org/`

## Тестовый алерт

```bash
/home/fast/autoparts/alert-bot/venv/bin/python \
  /home/fast/autoparts/alert-bot/scripts/ingest_alert.py \
  --source test --key manual --severity info --title test --message "Deploy OK"
```
