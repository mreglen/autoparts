# Инструкция по исправлению Nginx конфигурации

## ❌ Проблемы в текущей конфигурации:

### 1. **Нет location для /api/**
Frontend отправляет запросы к `/api/chats/...`, но в nginx только `/server/`

### 2. **Нет location для /ws/**  
Frontend подключается к `wss://svoygarage.ru/ws/chat/8`, но в nginx нет отдельного location для WebSocket

### 3. **WebSocket внутри /server/ работает не всегда**
Когда WebSocket вложен в location с префиксом, могут быть проблемы с Upgrade headers

---

## ✅ Решение:

### Вариант 1: Добавить новые location (РЕКОМЕНДУЕТСЯ)

Добавьте в ваш конфиг ПЕРЕД `location /server/`:

```nginx
# API Backend
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    proxy_read_timeout 300;
}

# WebSocket Support
location /ws/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

### Вариант 2: Изменить frontend

Изменить в `ChatSlice.js` чтобы использовал `/server/ws/` вместо `/ws/`, но это сложнее.

---

## 🚀 Как применить исправления:

### 1. Скопируйте исправленный конфиг:

```bash
# На сервере
sudo nano /etc/nginx/sites-available/svoygarage
```

Вставьте содержимое из файла `nginx-config-fixed.conf` (я его создал)

ИЛИ добавьте только новые location blocks в существующий конфиг.

### 2. Проверьте конфигурацию:

```bash
sudo nginx -t
```

Должно быть:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 3. Перезагрузите Nginx:

```bash
sudo systemctl reload nginx
```

### 4. Проверьте что backend запущен:

```bash
# Проверьте порт 8080
sudo netstat -tlnp | grep 8080
# или
sudo ss -tlnp | grep 8080

# Если не запущен, запустите:
cd /home/fast/autoparts/backend
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8080 --ws websockets
```

### 5. Проверьте CORS в backend:

Убедитесь что в `backend/app/main.py` разрешен ваш домен:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://svoygarage.ru", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🧪 Тестирование:

### 1. Проверьте API:

```bash
curl https://svoygarage.ru/api/chats
```

Должен вернуть JSON (не 404!)

### 2. Проверьте WebSocket:

Откройте браузер → F12 → Console:

```javascript
const ws = new WebSocket('wss://svoygarage.ru/ws/chat/8');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (e) => console.log('❌ WebSocket error', e);
ws.onmessage = (msg) => console.log('📨 Message:', msg.data);
```

### 3. Проверьте чат в браузере:

1. Откройте `https://svoygarage.ru/chats`
2. Откройте консоль (F12)
3. Не должно быть ошибок WebSocket
4. Должны загружаться сообщения

---

## 🔍 Troubleshooting:

### Ошибка 502 Bad Gateway:

```bash
# Проверьте что backend запущен
sudo systemctl status uvicorn
# или
ps aux | grep uvicorn

# Проверьте логи
sudo tail -f /var/log/nginx/svoygarage_ssl_error.log
```

### WebSocket не подключается:

```bash
# Проверьте nginx error log
sudo tail -f /var/log/nginx/svoygarage_ssl_error.log

# Проверьте что WebSocket endpoint есть в backend
curl -i -N \
    -H "Connection: Upgrade" \
    -H "Upgrade: websocket" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    https://svoygarage.ru/ws/chat/8
```

### Ошибка CORS:

Проверьте что в backend `.env`:
```env
FRONTEND_URL=https://svoygarage.ru
CORS_ORIGINS=["https://svoygarage.ru"]
```

---

## 📊 Итоговая структура URL:

```
Frontend (https://svoygarage.ru)
├── /                          → React App
├── /api/chats/...             → Backend API ✅
├── /ws/chat/8                 → WebSocket ✅
├── /uploads/...               → Static files ✅
├── /minio-api/...             → MinIO S3 API ✅
└── /minio-console/...         → MinIO Console ✅

Backend (http://127.0.0.1:8080)
├── /api/chats/...             → FastAPI routes
├── /ws/chat/{user_id}         → WebSocket endpoint
└── /uploads/...               → Upload directory
```

---

## ✅ Чеклист:

- [ ] Добавлен `location /api/` в nginx
- [ ] Добавлен `location /ws/` в nginx  
- [ ] Конфигурация проверена (`nginx -t`)
- [ ] Nginx перезапущен
- [ ] Backend запущен на порту 8080
- [ ] CORS настроен правильно
- [ ] API отвечает (`curl https://svoygarage.ru/api/chats`)
- [ ] WebSocket подключается (тест в браузере)
- [ ] Чат загружается без ошибок

---

## 📁 Файлы:

- Исправленный конфиг: `nginx-config-fixed.conf`
- Текущий конфиг: `/etc/nginx/sites-available/svoygarage`
- Backend main: `/home/fast/autoparts/backend/app/main.py`
- Frontend ChatSlice: `/var/www/my-autoparts/static/js/...`
