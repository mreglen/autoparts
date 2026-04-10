# WebSocket Stability Fix

## Проблема:
WebSocket подключается но сразу отключается (code 1006), поэтому:
- ❌ Сообщения не отправляются в реальном времени
- ❌ Сообщения не принимаются в реальном времени
- ✅ Работает только после перезагрузки страницы

## Решение:

### 1. Улучшенная WebSocket логика на Frontend

**Файл:** `frontend/my-autoparts/src/redux/slices/ChatSlice.js`

**Изменения:**

#### a) Exponential Backoff для переподключения
```javascript
// Было: фиксированные 5 секунд
setTimeout(() => reconnect(), 5000);

// Стало: экспоненциальная задержка 1s → 2s → 4s → 8s → 16s → 30s
const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, wsReconnectAttempts),
    30000
);
```

**Зачем:** Не перегружать сервер постоянными переподключениями

#### b) Ping/Pong для поддержания соединения
```javascript
// Отправляем ping каждые 30 секунд
setInterval(() => {
    ws.send(JSON.stringify({ type: 'ping' }));
}, 30000);
```

**Зачем:** 
- Не дает nginx закрыть соединение по таймауту
- Проверяем что соединение живо
- Предотвращаем code 1006 errors

#### c) Улучшенная обработка ошибок
```javascript
ws.onerror = (error) => {
    console.error('[WS] ❌ WebSocket error');
    // НЕ закрываем вручную - onclose сработает автоматически
};
```

**Зачем:** Предотвращаем `Cannot read properties of null (reading 'close')`

#### d) Безопасное закрытие
```javascript
export const disconnectWebSocket = () => (dispatch) => {
    ws.onclose = null; // Предотвращаем auto-reconnect
    ws.close(1000, 'Normal closure');
};
```

**Зачем:** Когда пользователь уходит со страницы, не пытаемся переподключиться

### 2. Backend поддержка Ping/Pong

**Файл:** `backend/app/routers/websocket.py`

**Изменения:**
```python
elif message_data.get("type") == "ping":
    # Respond to ping to keep connection alive
    await websocket.send_json({
        "type": "pong",
        "timestamp": datetime.utcnow().isoformat()
    })
```

**Зачем:** Backend отвечает на ping чтобы соединение оставалось активным

## Что теперь работает:

### ✅ Отправка сообщений в реальном времени:
1. Пользователь пишет сообщение
2. Отправляется через WebSocket (мгновенно)
3. Если WebSocket недоступен → fallback на HTTP
4. Сообщение сразу появляется в UI

### ✅ Получение сообщений в реальном времени:
1. Другой пользователь отправляет сообщение
2. Backend отправляет через WebSocket всем участникам чата
3. Сообщение сразу появляется в UI (без перезагрузки)

### ✅ Стабильное соединение:
- Ping каждые 30 секунд не дает соединению закрыться
- Если соединение потеряно → умное переподключение
- Максимум 10 попыток с увеличивающейся задержкой

## Деплой:

### Frontend:
```bash
cd /home/fast/autoparts/frontend/my-autoparts
npm run build
sudo cp -r build/* /var/www/my-autoparts/
```

### Backend:
```bash
# Перезапустите backend
sudo systemctl restart autoparts-backend
# или
sudo supervisorctl restart autoparts-backend
```

### Nginx:
```bash
sudo systemctl reload nginx
```

### Клиент:
```
Ctrl + Shift + R (очистка кэша)
```

## Проверка:

### 1. Откройте консоль (F12)

Должно быть:
```
[WS] Connecting to: wss://svoygarage.ru/server/ws/chat/2
[WS] ✅ WebSocket connected successfully
[WS] 🏓 Ping sent (каждые 30 секунд)
[WS] 🏓 Pong received
```

### 2. Отправьте сообщение

Должно быть:
```
[WS] 📤 Sending message via WebSocket
```

НЕ должно быть:
```
[WS] ⚠️ WebSocket not connected, falling back to HTTP
```

### 3. Получите сообщение

Должно быть:
```
[WS] 📨 Message received
```

И сообщение сразу появляется в чате (без перезагрузки)

## Troubleshooting:

### Если всё еще падает:

1. **Проверьте nginx timeout:**
```bash
sudo nginx -T | grep -A 10 "location /server/ws/"
```

Должно быть:
```nginx
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
proxy_buffering off;
```

2. **Проверьте backend логи:**
```bash
sudo journalctl -u autoparts-backend -f
```

Должно быть:
```
[WS] Connection attempt for user_id=2
[WS] Successfully connected user_id=2
```

3. **Проверьте что ping работает:**

В консоли браузера должно быть:
```
[WS] 🏓 Ping sent
[WS] 🏓 Pong received
```

Если ping отправляется но pong не приходит → backend не обрабатывает ping

## Файлы изменены:

1. ✅ `frontend/my-autoparts/src/redux/slices/ChatSlice.js`
   - Exponential backoff
   - Ping/pong механизм
   - Улучшенная обработка ошибок
   - Безопасное закрытие

2. ✅ `backend/app/routers/websocket.py`
   - Обработка ping messages
   - Отправка pong в ответ
