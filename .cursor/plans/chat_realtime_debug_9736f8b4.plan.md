---
name: Chat realtime debug
overview: "Устранить подтверждённые баги реального времени в чате: медиа не доставляются из Celery, реконнект бьётся о невосстановимые ошибки и не детектит «полумёртвое» соединение, HTTP-fallback плодит дубли, нет уведомления при активной вкладке. Все правки точечные и низкорисковые."
todos:
  - id: celery-media
    content: "chat_media_tasks.py: убрать локальную проверку active_connections, доставлять медиа через broadcast_to_chat (WS/Push + групповые чаты) с try/except и логом"
    status: completed
  - id: ws-reconnect
    content: "ChatSlice.js: guard на CONNECTING; не реконнектить на код 1008; watchdog по lastPongAt (форс-реконнект при отсутствии pong); возобновление по online/visibilitychange после лимита попыток"
    status: completed
  - id: http-fallback
    content: "ChatSlice.js: убрать двойной полный fetchChatMessages в sendMessageViaHTTP, полагаться на дедуп по id — устранить дубли и мигание треда"
    status: completed
  - id: inapp-notify
    content: "ChatSlice.js: звук/лёгкий in-app индикатор на входящее message не в текущем чате; обработка typing"
    status: completed
  - id: push-robust
    content: "subscribeToPushNotifications: проверка response.ok и лог; на логауте disconnectWebSocket + отписка push"
    status: completed
isProject: false
---

# Отладка чатов: реальное время, соединение, уведомления

Область ограничена подтверждёнными багами с низким риском (scope = safe). Архитектура (2 воркера gunicorn + Redis pub/sub `ws:push` + Redis online-счётчики) остаётся без изменений.

## 1. Backend: медиа из Celery не доходят в реальном времени (главный баг)

В [`backend/app/tasks/chat_media_tasks.py`](backend/app/tasks/chat_media_tasks.py) готовое медиа рассылается так:

```python
if manager.active_connections.get(chat.buyer_id):
    asyncio.run(manager.send_personal_message(message_response, chat.buyer_id))
if manager.active_connections.get(chat.seller_id):
    asyncio.run(manager.send_personal_message(message_response, chat.seller_id))
```

Celery — отдельный процесс, где `manager.active_connections` **всегда пустой**, поэтому условие никогда не выполняется и обновление медиа не уходит по WS (нужен ручной refresh).

- Убрать локальную проверку `active_connections.get(...)`.
- Доставлять через `broadcast_to_chat(message_response, chat.id, db, exclude_user_id=None)` — она сама решает WS/Push и покрывает групповые чаты (не только `buyer_id`/`seller_id`). Redis pub/sub доставит в тот воркер, где висит сокет.
- Обернуть в единый `asyncio.run(...)` с try/except и логом.

## 2. Frontend: качество WebSocket-соединения

Файл [`frontend/my-autoparts/src/redux/slices/ChatSlice.js`](frontend/my-autoparts/src/redux/slices/ChatSlice.js).

- **Гонка при подключении**: guard в `connectWebSocket` (строки 601-606) проверяет только `OPEN`. Добавить проверку `CONNECTING`, чтобы повторный вызов (StrictMode/ремоунт) не убивал уже открывающийся сокет.
- **Реконнект по невосстановимым кодам**: `onclose` (680-699) реконнектит на всё, кроме `1000`. Сервер шлёт `1008` при плохом/протухшем токене и «too many connections» (`websocket.py` 256-283). Для `1008` не долбить сервер бесконечно: остановить авто-реконнект и выставить `wsConnected=false` (UI уйдёт в HTTP-polling), не создавая шторм.
- **Watchdog пинга**: сейчас `pong` только логируется (675-677). Хранить `lastPongAt`; если за ~2 интервала (напр. 70с) понга нет — принудительно `ws.close()` → реконнект. Это ловит «полумёртвые» соединения.
- **Восстановление после лимита попыток**: после `MAX_RECONNECT_ATTEMPTS` (707-712) соединение умирает навсегда до перехода на `/chats`. Добавить мягкое возобновление: слушатели `online` и `visibilitychange` сбрасывают счётчик и вызывают реконнект, если пользователь на странице чата.

## 3. Frontend: дубли и лишние перезагрузки в HTTP-fallback

`sendMessageViaHTTP` (754-807) после отправки делает `fetchUserChats` + `fetchChatMessages` (полная перезагрузка треда). При восстановлении WS до/после это даёт гонку с оптимистичным сообщением.

- Полагаться на дедуп по `id` в `addWebSocketMessage` и на `sendMessage.fulfilled`.
- Убрать двойной полный `fetchChatMessages` после успешного HTTP-send (оставить лёгкое обновление списка чатов), чтобы не мигал тред и не плодились дубли.

## 4. Frontend: уведомление при активной другой вкладке / открытом чате

Сейчас на входящее `message` (649-664) нет ни звука, ни тоста, если вкладка на переднем плане, но открыт другой чат; foreground-`Notification` не вызывается.

- В обработчике `type: 'message'`: если сообщение не для текущего открытого чата и отправитель не сам пользователь — проиграть короткий звук и/или показать лёгкий in-app индикатор (тост/бейдж). Web Push оставить как есть для фонового режима.
- (Опц., мелочь) обработать `type: 'typing'`, который сервер уже шлёт (`websocket.py` 370-392), — индикатор «печатает».

## 5. Push-надёжность (клиент) + проверка конфигурации (ops)

- В `subscribeToPushNotifications` (830-895) добавить проверку `response.ok` у POST `/notifications/subscribe` и лог при ошибке (сейчас тихо).
- На логауте ([`AuthSlice.js`](frontend/my-autoparts/src/redux/slices/AuthSlice.js) 121-124) вызвать `disconnectWebSocket()` и отписать push-эндпоинт, чтобы чужие уведомления не текли на общий браузер.
- Ops (без кода): если push не приходят в фоне — проверить VAPID-ключи в конфиге бэкенда и таблицу `push_subscriptions`; это отдельно от кода и вне правок этого плана.

## Проверка

- Backend: прогнать `backend/tests/test_websocket_limits.py` и относящиеся тесты; ручной сценарий — загрузка фото в чат при открытом получателе, медиа должно появиться без refresh.
- Frontend: две вкладки/два пользователя — текст и медиа в реальном времени; обрыв сети → авто-восстановление по `online`; протухший токен (1008) → нет шторма реконнектов, работает polling.

## Явно вне области (по выбору scope = safe)

Не трогаем: серверные ping-фреймы, глобальный лимит соединений через Redis, проверку `session_token` в WS, лимиты `sg_conn` в nginx.