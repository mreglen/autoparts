# Marzban Node + флаги Happ VPN

Подключение дополнительного VPS как **Marzban Node** к существующей панели (master).

| Роль | IP (пример) | ПО |
|------|-------------|-----|
| Master (панель + бот) | `195.24.65.251` | `/opt/marzban-vpn`, Reality `8443` |
| Node | `212.102.227.25` | `/opt/marzban-node`, связь `62050`/`62051`, Reality `8443` |

---

## Как Happ VPN рисует флаги

Happ берёт **первый emoji-флаг** из **имени профиля** (часть после `#` в `vless://...#Имя` или имя в subscription).

| Где в Marzban | Влияет на Happ? |
|---------------|-----------------|
| Core Settings → inbound `tag` | Нет (внутренний ID) |
| Node Settings → Name | Нет (только в панели) |
| **Host Settings → Remark** | **Да** — сюда ставьте флаг в начале |
| Host Settings → Address / Port | Куда коннектиться клиенту |

Правильные Remark (символ флага, не `%F0%9F...`):

```text
🇩🇪 Germany | VLESS-Reality
🇳🇱 Amsterdam | VLESS-Reality
🇷🇺 Russia | VLESS-Reality
```

Неправильно: смайлик **перед** флагом — Happ не возьмёт флаг как иконку.

После двух Hosts одна subscription URL отдаёт список локаций с флагами.

---

## A. Команды на MASTER (панель)

### A1. Туннель к dashboard

```bash
# С вашего ПК (панель слушает только 127.0.0.1:62050 на master)
ssh -L 62050:127.0.0.1:62050 root@195.24.65.251
```

В браузере: `http://127.0.0.1:62050/dashboard/`

### A2. Сертификат для ноды

1. **Node Settings** → **Show Certificate** (или при добавлении ноды).
2. Скопируйте весь PEM (`-----BEGIN CERTIFICATE-----` …).

На master сохраните файл:

```bash
# На master
nano /root/marzban-node-client.pem
# Вставьте сертификат, сохраните Ctrl+O, Enter, Ctrl+X
chmod 600 /root/marzban-node-client.pem
```

Либо скачайте с ПК через туннель и положите на node через `scp` (см. раздел B).

### A3. (Опционально) Reality-ключи, если меняете/добавляете inbound

```bash
# На master
docker exec marzban-vpn xray x25519
openssl rand -hex 8
```

Private key + shortId → в Core Settings (inbound).  
Public key → в Host Settings (`pbk`).

Готовый JSON inbound: [`xray-inbound-reality.snippet.json`](xray-inbound-reality.snippet.json)  
(SNI `dl.google.com`, порт `8443`). Существующий inbound с `www.microsoft.com` можно **не трогать** — нода получит тот же Core config с панели.

### A4. Добавление ноды в UI (после установки на node)

Node Settings → Add New Marzban Node:

| Поле | Значение |
|------|----------|
| Name | `Germany` |
| Address | `212.102.227.25` |
| Port | `62050` |
| API Port | `62051` |
| Usage Ratio | `1` |
| Add as host for every inbound | **снять** (Hosts настроим вручную) |

Статус должен стать **connected**.

### A5. Host Settings (флаги для Happ)

Inbound: `VLESS TCP REALITY`

**Host 1 (master):**

- Remark: `🇷🇺 Russia | VLESS-Reality`
- Address: `195.24.65.251`
- Port: `8443`
- SNI: как в Reality (`www.microsoft.com` или ваш)
- Reality Public Key / Short ID: из текущего inbound

**Host 2 (node):**

- Remark: `🇩🇪 Germany | VLESS-Reality`
- Address: `212.102.227.25`
- Port: `8443`
- Те же Reality pbk/sid (общий inbound)  
  либо свои, если добавите отдельный inbound `VLESS TCP REALITY DE`

### A6. Проверка с master

```bash
# Токен админа Marzban
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Список нод
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool | head -80

# Ссылки тестового пользователя (должны быть две vless с разными #флагами)
curl -s -H "Authorization: Bearer ${TOKEN}" \
  http://127.0.0.1:62050/api/user/test_setup_001 \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("\n".join(d.get("links") or []))'
```

На master **не** открывайте 62050 наружу и **не** трогайте ufw-правила Nginx (80/443).

---

## B. Команды на NODE (чистая Ubuntu)

IP примера: `212.102.227.25`.

### B1. Скопировать пакет и сертификат

С вашего ПК или с master:

```bash
# Пакет из репозитория (после git pull на master)
scp -r root@195.24.65.251:/home/fast/autoparts/vpn-marzban-bot/node root@212.102.227.25:~/

# Сертификат с master на node
scp root@195.24.65.251:/root/marzban-node-client.pem root@212.102.227.25:/root/ssl_client_cert.pem
```

### B2. Установка одной командой

```bash
# На node
ssh root@212.102.227.25
cd ~/node
sed -i 's/\r$//' install-node.sh
chmod +x install-node.sh
sudo bash install-node.sh /root/ssl_client_cert.pem
```

Скрипт ставит Docker, копирует `docker-compose.yml`, кладёт сертификат в  
`/var/lib/marzban-node/ssl_client_cert.pem`, открывает порты ufw (add-only), запускает контейнер.

### B3. Ручной вариант (если без скрипта)

```bash
# На node
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/marzban-node /var/lib/marzban-node
cp ~/node/docker-compose.yml /opt/marzban-node/
cp /root/ssl_client_cert.pem /var/lib/marzban-node/ssl_client_cert.pem
chmod 600 /var/lib/marzban-node/ssl_client_cert.pem

# Firewall — только добавление
ufw allow 22/tcp comment 'SSH'
ufw allow 62050/tcp comment 'Marzban Node SERVICE'
ufw allow 62051/tcp comment 'Marzban Node API'
ufw allow 8443/tcp comment 'VLESS Reality'
# ufw enable   # только если понимаете, что SSH уже разрешён

cd /opt/marzban-node
docker compose up -d
docker compose logs -f --tail=50
```

### B4. Проверка портов на node

```bash
ss -tulpn | grep -E ':(62050|62051|8443)\s' || true
docker ps --filter name=marzban-node
```

После **Add Node** в панели Xray на ноде начнёт слушать `8443` (конфиг с master).

---

## C. Файлы в этом каталоге

| Файл | Назначение |
|------|------------|
| [`docker-compose.yml`](docker-compose.yml) | Контейнер `gozargah/marzban-node` |
| [`install-node.sh`](install-node.sh) | Установка на чистую Ubuntu |
| [`xray-inbound-reality.snippet.json`](xray-inbound-reality.snippet.json) | Шаблон inbound Reality |
| [`README-NODE.md`](README-NODE.md) | Эта инструкция |

---

## D. Импорт в Happ

1. Взять subscription URL или `vless://` из бота / панели.
2. В Happ: вставить из буфера.
3. В списке должны быть профили с флагами `🇷🇺` и `🇩🇪`.

---

## Troubleshooting

| Симптом | Что проверить |
|---------|----------------|
| Node disconnected | Сертификат PEM полный; `SERVICE_PROTOCOL=rest`; порты 62050/62051 открыты на node; Address = публичный IP ноды |
| Нет флага в Happ | Remark начинается с emoji-флага; Host Settings сохранены; обновить подписку в клиенте |
| Один профиль вместо двух | Добавлены оба Host (Russia + Germany) для нужного inbound |
| Клиент не коннектится к DE | `ufw allow 8443`; `ss -tulpn \| grep 8443` на node; нода connected |
| Конфликт 62050 | На master панель на `127.0.0.1:62050` — это не мешает node `0.0.0.0:62050` |
