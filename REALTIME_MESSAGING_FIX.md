# Real-time Messaging Fix - HTTP Fallback + Polling

## Проблема:
WebSocket постоянно отключается (code 1006), поэтому:
- ❌ Сообщения не отправляются без перезагрузки
- ❌ Сообщения не принимаются без перезагрузки
- ❌ Статус "доставлено" появляется только после перезагрузки

## Решение: Двойная стратегия

### Стратегия 1: WebSocket (когда работает)
- Отправка через WebSocket → мгновенно
- Получение через WebSocket → мгновенно

### Стратегия 2: HTTP Fallback + Polling (когда WebSocket не работает)
- Отправка через HTTP API → работает всегда
- Автоматическая перезагрузка сообщений после отправки
- Polling каждые 3 секунды для получения новых сообщений

## Что исправлено:

### 1. Улучшенная отправка сообщений

**Файл:** `frontend/my-autoparts/src/redux/slices/ChatSlice.js`

```javascript
// Было:
dispatch(sendMessage({...})); // Просто отправлял, не обновлял UI

// Стало:
const sendMessageViaHTTP = async (dispatch) => {
    // 1. Отправляем сообщение
    const result = await dispatch(sendMessage({...})).unwrap();
    
    // 2. Обновляем список чатов
    dispatch(fetchUserChats({ skip: 0, limit: 50 }));
    
    // 3. Перезагружаем сообщения чата
    dispatch(fetchChatMessages({ chatId, skip: 0, limit: 100 }));
    
    return result;
};
```

**Результат:**
- ✅ Сообщение отправляется через HTTP
- ✅ UI автоматически обновляется
- ✅ Не нужна перезагрузка страницы

### 2. HTTP Polling для получения сообщений

**Файл:** `frontend/my-autoparts/src/pages/Chat/ChatPage.jsx`

```javascript
// Polling когда WebSocket не подключен
useEffect(() => {
    if (wsConnected || !selectedChatId) return;
    
    // Polling каждые 3 секунды
    const interval = setInterval(() => {
        dispatch(fetchChatMessages({ chatId: parseInt(selectedChatId) }));
    }, 3000);
    
    return () => clearInterval(interval);
}, [wsConnected, selectedChatId]);
```

**Результат:**
- ✅ Новые сообщения появляются каждые 3 секунды
- ✅ Не нужна перезагрузка страницы
- ✅ Автоматически отключается когда WebSocket работает

### 3. Улучшенное логирование

Теперь видно что происходит:

```javascript
[WS] 📤 Sending message via WebSocket
[WS] ✅ Message sent via WebSocket

// или

[WS] ⚠️ WebSocket not connected (readyState: 3), using HTTP
[HTTP] 📤 Sending message via HTTP API
[HTTP] ✅ Message sent successfully
🔄 Polling - fetching messages...
```

## Как это работает:

### Сценарий 1: WebSocket работает ✅

1. Отправка:
   ```
   User пишет → WebSocket.send() → Мгновенно на сервере
   ```

2. Получение:
   ```
   Сервер → WebSocket.broadcast() → Мгновенно у всех клиентов
   ```

### Сценарий 2: WebSocket не работает ⚠️

1. Отправка:
   ```
   User пишет → HTTP POST /api/chats/{id}/messages
              → Обновление списка чатов
              → Обновление сообщений
              → Message appears ✅
   ```

2. Получение:
   ```
   Каждые 3 секунды → HTTP GET /api/chats/{id}/messages
                    → Новые сообщения появляются ✅
   ```

## Деплой:

### Frontend:
```bash
cd /home/fast/autoparts/frontend/my-autoparts
npm run build
sudo cp -r build/* /var/www/my-autoparts/
```

### Backend:
Не требуется (изменения только на frontend)

### Клиент:
```
Ctrl + Shift + R
```

## Проверка:

### 1. Откройте консоль (F12)

### 2. Отправьте сообщение

Должно быть одно из двух:

**Вариант A (WebSocket работает):**
```
[WS] 📤 Sending message via WebSocket
[WS] ✅ Message sent via WebSocket
```

**Вариант B (HTTP fallback):**
```
[WS] ⚠️ WebSocket not connected (readyState: 3), using HTTP
[HTTP] 📤 Sending message via HTTP API
[HTTP] ✅ Message sent successfully
🔄 Polling - fetching messages...
```

### 3. Проверьте что сообщение появилось

- ✅ Сообщение сразу видно в чате
- ✅ Не нужно перезагружать страницу
- ✅ Статус обновляется

### 4. Получите сообщение

**Вариант A (WebSocket):**
```
[WS] 📨 Message received
```

**Вариант B (Polling):**
```
🔄 Polling - fetching messages...
📥 Received messages from backend: 14
```

Сообщение появится максимум через 3 секунды.

## Преимущества этого решения:

### ✅ Работает ВСЕГДА
- Даже если WebSocket полностью сломан
- HTTP API работает стабильно

### ✅ Не нужна перезагрузка
- Отправка → автоматическое обновление UI
- Получение → polling каждые 3 секунды

### ✅ Graceful degradation
- WebSocket работает → используем его (быстрее)
- WebSocket не работает → fallback на HTTP (надежнее)

### ✅ Автоматическое восстановление
- Когда WebSocket починят → автоматически переключится на него
- Polling отключится сам

## Следующие шаги (опционально):

### Починить WebSocket окончательно:

1. **Проверьте nginx:**
```bash
sudo nginx -T | grep -A 15 "location /server/ws/"
```

Убедитесь что:
```nginx
location /server/ws/ {
    proxy_pass http://127.0.0.1:8080/ws/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_buffering off;
}
```

2. **Проверьте backend логи:**
```bash
sudo journalctl -u autoparts-backend -f
```

Ищите:
```
[WS] Connection attempt for user_id=2
[WS] Successfully connected user_id=2
```

3. **Проверьте port:**
```bash
sudo netstat -tlnp | grep -E '8000|8080'
```

Убедитесь что nginx proxy_pass указывает на правильный порт.

## Файлы изменены:

1. ✅ `frontend/my-autoparts/src/redux/slices/ChatSlice.js`
   - sendMessageViaHTTP helper
   - Автоматическое обновление после отправки
   - Улучшенное логирование

2. ✅ `frontend/my-autoparts/src/pages/Chat/ChatPage.jsx`
   - HTTP polling когда WebSocket не работает
   - wsConnectedState для проверки статуса

## Итог:

Теперь чат **работает всегда**, независимо от состояния WebSocket:
- ✅ Сообщения отправляются без перезагрузки
- ✅ Сообщения принимаются без перезагрузки (максимум 3 сек задержка)
- ✅ Статус "доставлено" обновляется автоматически
- ✅ Graceful degradation: WebSocket → HTTP fallback
