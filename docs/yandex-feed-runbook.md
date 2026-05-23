# Runbook: Яндекс товарный фид (used-only)

Документ для администраторов платформы `svoygarage.ru`.

## 1) Подготовка OAuth в Яндексе

1. В приложении OAuth Яндекса должен быть включен `Authorization Code` flow.
2. Redirect URI приложения должен указывать на:
   - `https://svoygarage.ru/api/admin/yandex/oauth/callback`
3. В `/admin-settings` заполнить:
   - `Client ID`
   - `Client secret`
4. Нажать **«Подключить Яндекс (OAuth code)»**.

## 2) Проверка сайта в Вебмастере

1. В блоке «Сайт в Вебмастере» указать `https://svoygarage.ru`.
2. Нажать **«Auto-try добавить/проверить host»**.
3. Если API вернул необходимость ручной проверки:
   - перейти в документацию подтверждения прав:
   - <https://yandex.ru/dev/webmaster/doc/ru/concepts/verification>
4. После подтверждения прав повторить auto-try.

## 3) Настройка фида

В `/admin-settings` проверить:

- `feed_type`: по умолчанию `GOODS`
- `regionIds`: по умолчанию `225`
- `condition.type` для б/у: по умолчанию `preowned`
- `condition.reason`: человеко-понятный текст
- `event-driven sync`: включен
- `debounce`: 300 секунд
- `контрольный sync`: 720 минут

Публичный URL фида:

- `https://svoygarage.ru/api/feeds/yandex/used.yml`

## 4) Ручной запуск и мониторинг

1. Нажать **«Загрузить фид сейчас (async)»**.
2. Следить за полями:
   - `last_request_id`
   - `last_process_status`
   - `last_error`
3. При необходимости открыть **«Список фидов в Вебмастере»**.

## 5) Автообновление

- При изменениях used-товаров/остатков система ставит `pending_sync=true`.
- Планировщик проверяет состояние каждые 5 минут.
- При превышении debounce запускается асинхронный sync.
- Даже без событий выполняется контрольный запуск по интервалу.

## 6) Типовые ошибки и действия

- `HOST_NOT_VERIFIED`
  - Подтвердить права на сайт в Вебмастере, затем повторить sync.
- `BAD_HTTP_CODE`
  - Проверить доступность feed URL, SSL, прокси, firewall.
- `BAD_MIME_TYPE`
  - Убедиться, что endpoint отдает `application/xml`/`text/xml`/`application/octet-stream`.
- `TIMED_OUT`
  - Повторить sync, проверить скорость ответа feed endpoint.
- `INVALID_USER_ID`
  - Переподключить OAuth в `/admin-settings`.
- `FEED_ALREADY_ADDED`
  - Не критично, сверить текущий список фидов.

## 7) Что проверять после релиза

1. В `/admin-settings`:
   - OAuth connected = `true`
   - host_id заполнен
   - feed preview возвращает offers > 0
2. Feed endpoint открывается извне:
   - `GET /api/feeds/yandex/used.yml` -> HTTP 200
   - корректный `Content-Type`
3. Асинхронная загрузка завершилась `OK`.
4. В кабинете Яндекс Товаров нет критичных ошибок структуры фида.

## 8) Безопасность

- `Client secret`, `access_token`, `refresh_token` хранятся в БД только в зашифрованном виде.
- Доступ к настройкам Яндекс — только для `is_admin`.
