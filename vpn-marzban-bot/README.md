# Marzban (VLESS Reality) + публичный Telegram-бот

Самодостаточный пакет для развёртывания на **уже работающем** Ubuntu/Debian VPS.
Существующие службы (Nginx/Apache на 80/443 и т.д.) **не перезаписываются**.

| Компонент | Порт | Назначение |
|-----------|------|------------|
| Панель Marzban | `127.0.0.1:62050` | API + dashboard (только localhost) |
| VLESS Reality (Xray) | `0.0.0.0:8443` | VPN-трафик клиентов |
| Telegram-бот | — | Исходящие запросы к Telegram + localhost API |

Пути на сервере (изолированы от типичного `/opt/marzban`):

- конфиги Marzban: `/opt/marzban-vpn/`
- данные Marzban: `/var/lib/marzban-vpn/`
- бот: `/opt/marzban-vpn-bot/`

---

## 0. Что нужно заранее

1. SSH-доступ с правами `sudo` на VPS.
2. Docker Engine + плагин Compose v2 (если нет — установка ниже).
3. Токен Telegram-бота от [@BotFather](https://t.me/BotFather) (`/newbot`).
4. Публичный IP сервера (или домен, указывающий на него).

Скопируйте этот каталог `vpn-marzban-bot/` на сервер, например:

```bash
# С вашей машины (Windows PowerShell / Linux / macOS):
# Загружает пакет в домашний каталог на VPS
scp -r vpn-marzban-bot USER@YOUR_SERVER_IP:~/
```

Дальше все команды — **на сервере по SSH**.

---

## 1. Проверка сервера (ничего не ломаем)

```bash
# Подключение к VPS
ssh USER@YOUR_SERVER_IP

# Обновлять пакеты не обязательно для VPN; при желании:
# sudo apt update
# (не запускайте dist-upgrade «на автомате» на проде без окна обслуживания)

# Какие процессы уже слушают критичные и наши кандидатные порты?
# Если 80/443 заняты веб-сервером — ЭТО НОРМАЛЬНО, мы их не трогаем.
sudo ss -tulpn | grep -E ':(80|443|8000|8443|62050)\s' || true

# Есть ли Docker?
docker --version
docker compose version

# Есть ли Nginx/Apache (только смотрим, не правим)?
ls /etc/nginx/sites-enabled 2>/dev/null || true
ls /etc/apache2/sites-enabled 2>/dev/null || true
systemctl is-active nginx 2>/dev/null || true
systemctl is-active apache2 2>/dev/null || true

# Текущий firewall (только просмотр)
sudo ufw status verbose 2>/dev/null || true
sudo iptables -L INPUT -n 2>/dev/null | head -n 40 || true
```

### Если порты 8443 или 62050 уже заняты

Выберите другие свободные порты и **везде** замените:

- Reality: в `xray_config.json` поле `"port"`
- Панель: в `.env` Marzban `UVICORN_PORT=...`
- Бот: `MARZBAN_BASE_URL=http://127.0.0.1:НОВЫЙ_ПОРТ`
- Firewall: правила только для новых портов

Проверка «свободен ли порт»:

```bash
# Должно быть пусто, если порт свободен
sudo ss -tulpn | grep ':8443\s' || echo "8443 свободен"
sudo ss -tulpn | grep ':62050\s' || echo "62050 свободен"
```

### Установка Docker (только если его ещё нет)

```bash
# Официальный удобный скрипт Docker (ставит Docker Engine)
curl -fsSL https://get.docker.com | sudo sh

# Добавить текущего пользователя в группу docker (чтобы не писать sudo каждый раз)
sudo usermod -aG docker "$USER"
# Перелогиньтесь в SSH, чтобы группа применилась
```

---

## 2. Развёртывание Marzban (Docker)

### 2.1. Каталоги

```bash
# Создаём изолированные каталоги (не /opt/marzban и не /var/lib/marzban)
sudo mkdir -p /opt/marzban-vpn /var/lib/marzban-vpn

# Копируем файлы из загруженного пакета
sudo cp ~/vpn-marzban-bot/marzban/docker-compose.yml /opt/marzban-vpn/
sudo cp ~/vpn-marzban-bot/marzban/.env.example /opt/marzban-vpn/.env
sudo cp ~/vpn-marzban-bot/marzban/xray_config.json.example /var/lib/marzban-vpn/xray_config.json

# Права на конфиги
sudo chmod 600 /opt/marzban-vpn/.env
```

### 2.2. Редактируем `.env` панели

```bash
sudo nano /opt/marzban-vpn/.env
```

Обязательно задайте:

- `SUDO_USERNAME` / `SUDO_PASSWORD` — логин в dashboard
- `UVICORN_HOST=127.0.0.1` — панель только локально (безопасно рядом с чужими сервисами)
- `UVICORN_PORT=62050`
- `XRAY_SUBSCRIPTION_URL_PREFIX=http://YOUR_SERVER_IP:62050` — подставьте IP/домен  
  (для клиентов `vless://` из бота важнее Host Settings; prefix нужен для subscription URL)

Сохраните: `Ctrl+O`, Enter, `Ctrl+X`.

### 2.3. Первый запуск контейнера (чтобы появился бинарник xray)

```bash
cd /opt/marzban-vpn

# Подтянуть образ и запустить в фоне
sudo docker compose up -d

# Смотрим логи (Ctrl+C только выходит из логов, контейнер продолжает работать)
sudo docker compose logs -f --tail=80
```

Имя контейнера в compose: `marzban-vpn`.

### 2.4. Генерация ключей Reality

```bash
# X25519: Private key (вставляем в xray_config) и Public key (для Host Settings / клиентов)
sudo docker exec marzban-vpn xray x25519

# shortId: 8 байт hex (16 символов)
openssl rand -hex 8
```

Пример вывода `x25519`:

```text
Private key: ....
Public key: ....
```

Впишите **Private key** и **shortId** в конфиг:

```bash
sudo nano /var/lib/marzban-vpn/xray_config.json
```

Замените:

- `"REPLACE_WITH_X25519_PRIVATE_KEY"` → Private key
- `"REPLACE_WITH_SHORT_ID_HEX"` → результат `openssl rand -hex 8`

SNI по умолчанию: `www.microsoft.com` (dest `www.microsoft.com:443`).  
Альтернатива: `dl.google.com` — тогда **и** `dest`, **и** `serverNames` должны совпадать с выбранным хостом.

Перезапуск после правок:

```bash
cd /opt/marzban-vpn
sudo docker compose restart
```

### 2.5. Проверка панели API

```bash
# Должен ответить HTML/JSON документации (панель слушает localhost)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:62050/docs

# Dashboard через SSH-туннель с вашего ПК (не трогаем Nginx на сервере):
# ssh -L 62050:127.0.0.1:62050 USER@YOUR_SERVER_IP
# Затем в браузере: http://127.0.0.1:62050/dashboard/
```

Войдите логином/паролем из `.env`.

### 2.6. Host Settings (обязательно для рабочих `vless://`)

В панели Marzban:

1. **Settings → Hosts** (Host Settings).
2. Добавьте/отредактируйте хост для inbound `VLESS TCP REALITY`:
   - Address: публичный IP или домен сервера
   - Port: `8443` (или ваш порт Reality)
   - SNI / Host: `www.microsoft.com`
   - Reality Public Key: **Public key** из `xray x25519`
   - Short ID: тот же, что в `xray_config.json`
   - Flow: `xtls-rprx-vision` (если доступно в UI)
3. Сохраните.

Без корректных Host Settings бот создаст пользователя, но ссылка может быть неполной или с неверным адресом/портом.

### 2.7. Firewall — только добавление правил

**Не выполняйте** `ufw --force reset`, `iptables -F`, `iptables -X`.

```bash
# Разрешить входящий VPN-трафик на Reality-порт
sudo ufw allow 8443/tcp comment 'Marzban VLESS Reality'

# Панель по умолчанию на 127.0.0.1 — наружу открывать НЕ нужно.
# Если сознательно хотите публичную панель:
#   1) в .env поставьте UVICORN_HOST=0.0.0.0
#   2) sudo ufw allow 62050/tcp comment 'Marzban panel'
#   3) sudo docker compose restart

# Применить/проверить (если ufw был inactive — включение спросит подтверждение;
# убедитесь, что SSH-порт уже разрешён, иначе можно потерять доступ!)
sudo ufw status
# sudo ufw enable   # только если понимаете последствия для SSH
```

Проверка, что Reality слушает:

```bash
sudo ss -tulpn | grep ':8443\s' || true
```

---

## 3. Telegram-бот

### 3.1. Установка файлов и venv

```bash
# Отдельный системный пользователь для бота (без shell-логина)
sudo useradd --system --home /opt/marzban-vpn-bot --shell /usr/sbin/nologin marzbanbot || true

sudo mkdir -p /opt/marzban-vpn-bot
sudo cp ~/vpn-marzban-bot/bot/main.py /opt/marzban-vpn-bot/
sudo cp ~/vpn-marzban-bot/bot/requirements.txt /opt/marzban-vpn-bot/
sudo cp ~/vpn-marzban-bot/bot/.env.example /opt/marzban-vpn-bot/.env

# Python venv
sudo apt-get install -y python3-venv python3-pip
sudo python3 -m venv /opt/marzban-vpn-bot/.venv
sudo /opt/marzban-vpn-bot/.venv/bin/pip install --upgrade pip
sudo /opt/marzban-vpn-bot/.venv/bin/pip install -r /opt/marzban-vpn-bot/requirements.txt

# Права: .env только у пользователя бота
sudo chown -R marzbanbot:marzbanbot /opt/marzban-vpn-bot
sudo chmod 600 /opt/marzban-vpn-bot/.env
```

### 3.2. Настройка `.env` бота

```bash
sudo -u marzbanbot nano /opt/marzban-vpn-bot/.env
```

Заполните:

- `BOT_TOKEN` — от BotFather
- `MARZBAN_BASE_URL=http://127.0.0.1:62050`
- `MARZBAN_USERNAME` / `MARZBAN_PASSWORD` — те же, что у панели
- `INBOUND_TAG=VLESS TCP REALITY` — должен совпадать с `tag` в `xray_config.json`
- `DATA_LIMIT_GB=50`, `EXPIRE_DAYS=30` — квоты (поставьте `0` для безлимита)
- `COOLDOWN_SECONDS=60` — антифлуд на пользователя Telegram

### 3.3. Ручной тест перед systemd

```bash
# Запуск от пользователя бота (Ctrl+C остановит)
sudo -u marzbanbot /opt/marzban-vpn-bot/.venv/bin/python /opt/marzban-vpn-bot/main.py
```

В Telegram: `/start` → кнопка **«Получить ключ VPN»** → должны прийти `vless://...` и инструкция для Happ.

---

## 4. Автозапуск бота (systemd)

```bash
# Unit-файл (не затрагивает nginx/apache и другие unit'ы)
sudo cp ~/vpn-marzban-bot/bot/marzban-vpn-bot.service /etc/systemd/system/marzban-vpn-bot.service

sudo systemctl daemon-reload
sudo systemctl enable --now marzban-vpn-bot.service

# Статус и логи
sudo systemctl status marzban-vpn-bot.service
sudo journalctl -u marzban-vpn-bot -f --no-pager
```

Перезагрузка VPS: Docker (`restart: unless-stopped`) поднимет Marzban, systemd — бота.

Полезные команды:

```bash
sudo systemctl restart marzban-vpn-bot
sudo systemctl stop marzban-vpn-bot
cd /opt/marzban-vpn && sudo docker compose restart
cd /opt/marzban-vpn && sudo docker compose logs -f --tail=100
```

---

## 5. Импорт в Happ VPN

1. В боте нажать **«Получить ключ VPN»**.
2. Скопировать строку `vless://...`.
3. Открыть **Happ VPN**.
4. Вставить конфигурацию из буфера (импорт / «+» / paste).
5. Подключиться.

В рабочей ссылке обычно есть: `security=reality`, `pbk=...`, `sid=...`, `sni=www.microsoft.com`, порт `8443`.

Альтернатива: импорт **ссылки подписки** из того же сообщения бота (если панель доступна клиенту по `XRAY_SUBSCRIPTION_URL_PREFIX`).

---

## 6. Альтернатива: бот в Docker (опционально)

Основной рекомендованный способ — systemd выше. Если предпочитаете контейнер, пример рядом с Marzban **не** используйте `network_mode: host` для бота; достаточно bridge + доступ к `host-gateway`:

```yaml
# Пример (добавлять только если понимаете сеть Docker на своём хосте)
services:
  vpn-bot:
    image: python:3.12-slim
    working_dir: /app
    volumes:
      - /opt/marzban-vpn-bot:/app
    command: sh -c "pip install -r requirements.txt && python main.py"
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      # В .env бота тогда MARZBAN_BASE_URL=http://host.docker.internal:62050
      # и UVICORN_HOST панели должен принимать соединения с docker0 (часто 0.0.0.0)
```

На прод с чужими сервисами проще оставить панель на `127.0.0.1` и бота в systemd на хосте.

---

## 7. Устранение неполадок

| Симптом | Что проверить |
|---------|----------------|
| Бот пишет ошибку авторизации Marzban | Логин/пароль в `/opt/marzban-vpn-bot/.env` и `/opt/marzban-vpn/.env`; `curl http://127.0.0.1:62050/docs` |
| Пользователь создаётся, но нет `vless://` | Host Settings в панели; совпадение `INBOUND_TAG` и `tag` inbound |
| Клиент не коннектится | Порт 8443 открыт в ufw/облачном SG; SNI/dest; Public key в Host Settings; `ss -tulpn \| grep 8443` |
| Конфликт портов | `ss -tulpn`; сменить 8443/62050 везде |
| Панель недоступна из браузера | Она на `127.0.0.1` — используйте SSH-туннель |
| `409 User already exists` | Редко при коллизии username; бот генерирует случайный суффикс — повторите |
| После reboot бот не встал | `systemctl status marzban-vpn-bot`; `docker ps` |

Откат только наших компонентов (существующие сайты не затрагиваются):

```bash
sudo systemctl disable --now marzban-vpn-bot.service
sudo rm -f /etc/systemd/system/marzban-vpn-bot.service
sudo systemctl daemon-reload

cd /opt/marzban-vpn && sudo docker compose down
# Данные можно оставить или удалить:
# sudo rm -rf /opt/marzban-vpn /var/lib/marzban-vpn /opt/marzban-vpn-bot

# Firewall: удалить только наши allow-правила (номера смотрите в ufw status numbered)
# sudo ufw status numbered
# sudo ufw delete NUM
```

---

## 8. Структура пакета

```text
vpn-marzban-bot/
  README.md
  marzban/
    docker-compose.yml
    .env.example
    xray_config.json.example
  bot/
    main.py
    requirements.txt
    .env.example
    marzban-vpn-bot.service
```

---

## Важно

- Публичная выдача ключей всем желающим может исчерпать трафик/CPU VPS. Квоты `DATA_LIMIT_GB` / `EXPIRE_DAYS` и `COOLDOWN_SECONDS` смягчают риск, но не заменяют мониторинг.
- Не открывайте панель наружу без необходимости.
- Не меняйте конфиги существующего Nginx/Apache ради этого стека — панель доступна через SSH-туннель.
