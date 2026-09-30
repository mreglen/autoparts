# Radicale (CalDAV) — установка на прод

Синхронизация записей на осмотр в Календарь/Напоминания iPhone.
Backend пишет `.ics` напрямую в `/var/lib/radicale/collections/collection-root/`
(сервис `app/services/autoservice_caldav.py`), iPhone читает через
`https://svoygarage.ru/caldav/` → Radicale `127.0.0.1:5232`.

## Разовая установка

```bash
# 1. venv + пакет
mkdir -p /home/fast/radicale
python3 -m venv /home/fast/radicale/venv
/home/fast/radicale/venv/bin/pip install radicale

# 2. конфиг
mkdir -p /etc/radicale /var/lib/radicale/collections
cp /home/fast/autoparts/docs/ops/radicale-config.example /etc/radicale/config
touch /etc/radicale/users
chown -R fast:fast /var/lib/radicale
chown fast:fast /etc/radicale/users          # backend (fast) пишет htpasswd
chmod 600 /etc/radicale/users

# 3. systemd
cp /home/fast/autoparts/docs/ops/radicale.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now radicale
systemctl is-active radicale
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5232/   # 401 — норма (нужен логин)

# 4. nginx (location /caldav/ уже в docs/nginx/svoygarage.conf)
sudo update --nginx      # или скопировать conf + nginx -t + systemctl reload nginx

# 5. включить синк в backend/.env
echo 'CALDAV_SYNC_ENABLED=true' >> /home/fast/autoparts/backend/.env
systemctl restart kroan.service celery.service
```

## Проверка

- В админке автосервиса: Настройки → iPhone → «Подключить iPhone» → получить
  сервер/логин/пароль.
- На iPhone: Настройки → Календарь → Учётные записи → Добавить → Другое →
  CalDAV → ввести сервер `https://svoygarage.ru/caldav/`, логин `u<id>`, пароль.
- В Календаре появится «Записи на осмотр», в Напоминаниях — список задач.
  Алерты: за 1 час, за 15 минут и накануне в 20:00.

## Как устроено

- `caldav_accounts` — привязка user → `caldav_username` (`u<user_id>`);
  пароль только в `/etc/radicale/users` (apr1-md5), в БД не хранится.
- Коллекции сотрудника: `inspection-events` (VEVENT → Календарь) и
  `inspection-tasks` (VTODO → Напоминания) — права Radicale `owner_only`.
- Синк: точечный Celery-таск при create/patch/delete записи
  (`autoservice.sync_caldav_org`) + reconcile каждые 5 мин
  (`autoservice.sync_caldav_all`). В ленте только статус `confirmed`
  (как в планировщике); удалённые/отменённые записи стираются
  из коллекций — пропадают и на телефоне.
- Таймзона событий — Europe/Yekaterinburg; без времени — событие на весь день.
