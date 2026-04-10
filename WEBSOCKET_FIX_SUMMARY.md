# WebSocket Connection Fix

## Проблема (Problem)

WebSocket не подключается на production сервере `svoygarage.ru`. Ошибки в консоли:
- `WebSocket error` при подключении к `wss://svoygarage.ru/ws/chat/2`
- `Cannot read properties of null (reading 'close')` в ChatSlice.js:516

## Причина (Root Cause)

1. **Неправильный WebSocket URL**: 
   - Frontend пытался подключиться к `wss://svoygarage.ru/ws/chat/2`
   - Но backend работает по адресу `https://svoygarage.ru/server/` (указано в `.env`)
   - Правильный URL должен быть: `wss://svoygarage.ru/server/ws/chat/2`

2. **Null reference error**:
   - При ошибке WebSocket код пытался вызвать `ws.close()` когда `ws` уже был `null`

## Решение (Solution)

### 1. Добавлена конфигурация WebSocket URL

**Файл:** `frontend/my-autoparts/src/utils/apiClient.js`

Добавлена функция `getWebSocketBaseUrl()`, которая:
- Берет `BACKEND_BASE` из environment variables
- Конвертирует `http://` → `ws://` и `https://` → `wss://`
- Сохраняет путь `/server` если он есть

```javascript
export const getWebSocketBaseUrl = () => {
    let backendUrl = BACKEND_BASE || '';
    backendUrl = backendUrl.replace(/\/+$/, '');
    
    let wsUrl = backendUrl
        .replace(/^http:\/\//, 'ws://')
        .replace(/^https:\/\//, 'wss://');
    
    return wsUrl;
};
```

### 2. Обновлен ChatSlice

**Файл:** `frontend/my-autoparts/src/redux/slices/ChatSlice.js`

Изменения:
- Импорт `getWebSocketBaseUrl` из apiClient
- Использование конфигурируемого URL вместо хардкода
- Добавлена проверка на `null` перед вызовом `ws.close()`

```javascript
// Было (incorrect):
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws/chat/${userId}`;

// Стало (correct):
const wsBaseUrl = getWebSocketBaseUrl();
const wsUrl = `${wsBaseUrl}/ws/chat/${userId}`;
```

### 3. Улучшено логирование на backend

**Файл:** `backend/app/routers/websocket.py`

Добавлено логирование для отладки подключений:
```python
print(f"[WS] Connection attempt for user_id={user_id}")
print(f"[WS] Client: {websocket.client}")
print(f"[WS] Successfully connected user_id={user_id}")
```

## Environment Configuration

### Development (.env):
```env
REACT_APP_API_BASE_URL=http://127.0.0.1:8000/api
REACT_APP_BACKEND_BASE_URL=http://127.0.0.1:8000
```
→ WebSocket URL: `ws://127.0.0.1:8000/ws/chat/{userId}`

### Production (.env):
```env
REACT_APP_API_BASE_URL=https://svoygarage.ru/server/api
REACT_APP_BACKEND_BASE_URL=https://svoygarage.ru/server
```
→ WebSocket URL: `wss://svoygarage.ru/server/ws/chat/{userId}`

## Проверка (Verification)

После деплоя проверьте:

1. **Откройте консоль браузера** на production сайте
2. **Убедитесь что WebSocket подключается** к правильному URL:
   ```
   [WS] Connecting to: wss://svoygarage.ru/server/ws/chat/2
   [WS] WebSocket connected
   ```

3. **На backend сервере** проверьте логи:
   ```
   [WS] Connection attempt for user_id=2
   [WS] Client: <client info>
   [WS] Successfully connected user_id=2
   ```

## Важно (Important Notes)

1. **Nginx/Reverse Proxy**: Если используется nginx, убедитесь что он правильно проксирует WebSocket:
   ```nginx
   location /server/ws/ {
       proxy_pass http://backend:8000/ws/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

2. **Backend должен поддерживать WebSocket**: Убедитесь что uvicorn запущен с поддержкой WebSocket (обычно включено по умолчанию)

3. **CORS**: WebSocket не подвержен CORS ограничениям, но сервер должен принимать подключения

## Файлы изменены (Files Modified)

1. `frontend/my-autoparts/src/utils/apiClient.js` - добавлена `getWebSocketBaseUrl()`
2. `frontend/my-autoparts/src/redux/slices/ChatSlice.js` - исправлен URL и null check
3. `backend/app/routers/websocket.py` - добавлено логирование
