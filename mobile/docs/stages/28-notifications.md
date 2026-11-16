# Этап 28 — Уведомления (in-app центр)

План этапа из `mobile/docs/PLAN-client.md`. Статус: **реализовано** (16.11.2026).

## Что сделано

### Backend

- **`app/models/notification.py`** — новая модель `UserNotification`
  (`user_notifications`): `user_id`, `event_type`, `title`, `body`, `url`,
  `data` (JSON), `is_read`, `created_at`. Таблица создаётся автоматически
  через `Base.metadata.create_all` при старте (новых таблиц нет в проде).
- **`app/tasks/notification_tasks.py`** — `deliver_user_notification` теперь
  пишет строку в in-app ленту **до** push/email-отправки и независимо от
  channel-preferences (это внутренний инбокс приложения; prefs управляют
  только push/email). Ошибка записи ленты логируется и не ломает доставку.
  Title/body берутся из `push_data` (title/body/url), fallback — email subject/body.
- **`app/routers/notifications.py`** — новые эндпоинты:
  - `GET /api/notifications/feed?limit&offset` → `{items, unread_count}`;
  - `POST /api/notifications/feed/{id}/read` — 404 чужому/несуществующему;
  - `POST /api/notifications/feed/read-all`.
- **`app/schemas/notification.py`** — `UserNotificationView`,
  `UserNotificationFeedResponse`.
- **`scripts/export_openapi.py`** — добавлен префикс `/api/notifications/`
  (туда же попали `/preferences`, `/subscribe`, `/vapid-public-key` — пригодятся
  на этапе 30). `openapi.json`/`schema.d.ts` регенерированы.
- **Тесты:** `tests/test_notification_feed.py` — 8 шт. (feed list/clamp,
  mark read owner/404, read-all, запись в deliver, fallback title, skip без user).

### Mobile

- **`src/api/notifications.ts`** — `fetchNotificationFeed` (cachedGet),
  `markNotificationRead`, `markAllNotificationsRead` (apiSend + инвалидация
  entity `notifications`).
- **`src/offline/policies.ts`** — политика `notifications`: `/api/notifications`,
  ttl 5 мин, offlineReadable, hot.
- **`ClientNotificationsScreen`** (новый роут «Уведомления»): список с
  непрочитанными (левая полоса + точка), «Прочитать все», оптимистичное
  помечание прочитанным, pull-to-refresh, `StaleDataBadge`, пустое состояние.
- **`ClientMoreScreen`** — строка «Уведомления» со счётчиком непрочитанных
  (`unread_count` из feed, limit=1).
- Навигация: `ClientNotifications` в `RootStackParamList` + `RootNavigator`.

## Решения и ограничения

- **Deep-link по тапу не сделан:** push_data.url ведёт на веб-страницы
  (`/autoservice/my-bookings`), а табы клиента — вложенный навигатор, до которого
  из stack-экрана нет прямого перехода. Тап помечает прочитанным; переходы по
  типам событий — отдельной задачей при рефакторинге навигации (можно через
  `navigationRef`/событие). Зафиксировано как известное ограничение.
- **Push на мобильных:** `expo-notifications`/FCM не подключались — iOS в Expo Go
  push не получит в любом случае; in-app центр работает на обеих платформах.
  Web-push подписки (`/subscribe`) останутся для веб-клиентов.
- **События в ленте:** сейчас пишутся все `dispatch_user_notification` —
  записи клиента (accepted/confirmed/cancelled/reminder) и staff-события
  (лента per-user, staff-лента тоже будет наполняться — плюс на будущее).
- Уведомлений о смене статуса заказ-наряда для клиента на бэкенде пока нет —
  появятся автоматически, когда такие dispatch-вызовы добавят (лента уже готова).

## Проверки

- Backend: `test_notification_feed` — 8/8 OK.
- Mobile: typecheck, lint, jest 27/27.
- E2E: запись → подтверждение СТО → уведомление в ленте — проверить на устройстве.
