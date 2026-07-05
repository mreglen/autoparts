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
systemctl status alert-bot
journalctl -u alert-bot -f
```

Авторизация: `/start` в @svoygarage_bot → email администратора → пароль.

## Тестовый алерт

```bash
/home/fast/autoparts/alert-bot/venv/bin/python \
  /home/fast/autoparts/alert-bot/scripts/ingest_alert.py \
  --source test --key manual --severity info --title test --message "Deploy OK"
```
