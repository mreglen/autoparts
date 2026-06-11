# Настройка Яндекс Вебмастера и Google Search Console

Операционный чеклист для этапа 7 SEO Master Plan.

## Общие шаги

1. Убедитесь, что в проде доступен `sitemap.xml` (индекс с 8 дочерними sitemap).
2. Регион продвижения: **Свердловская область** (Екатеринбург).
3. «Важные страницы»: топ-100 карточек + все brand/category/geo landing из админки SEO.

## Яндекс Вебмастер

1. **Админ → Настройки → Яндекс фид** — сохраните `client_id` / `client_secret`, подключите OAuth.
2. Нажмите **«Синхронизировать сайт»** — host_id привяжется к `svoygarage.ru`.
3. Подтвердите права на сайт (DNS/HTML/meta), если сайт только что добавлен.
4. Загрузите sitemap: `https://svoygarage.ru/sitemap.xml`.
5. В разделе **Поисковые запросы** проверяйте показы/клики еженедельно.
6. KPI в админке: **Аналитика → SEO → SEO KPI** (блок «Яндекс Вебмастер»).

### API для KPI

Используются методы Webmaster API v4:

- `GET .../search-queries/popular` — топ запросов за период
- `GET .../search-queries/all/history` — агрегаты по всем запросам

## Google Search Console

1. Создайте OAuth-приложение в [Google Cloud Console](https://console.cloud.google.com/).
2. Включите **Google Search Console API**.
3. Redirect URI: `{PUBLIC_BASE_URL}/api/admin/google/oauth/callback`
4. Scope: `https://www.googleapis.com/auth/webmasters.readonly`
5. **Админ → Аналитика → SEO → SEO KPI** — сохраните `client_id` / `client_secret`, нажмите **«Подключить GSC»**.
6. Добавьте property `https://svoygarage.ru/` (или `sc-domain:svoygarage.ru`) и подтвердите права.
7. Отправьте sitemap: `https://svoygarage.ru/sitemap.xml`.

### Переменные окружения (опционально)

```env
GOOGLE_OAUTH_REDIRECT_URI=https://svoygarage.ru/api/admin/google/oauth/callback
GOOGLE_CREDENTIALS_SECRET=...  # если нужен отдельный ключ шифрования
```

## Мониторинг после деплоя этапов 1–6

- Через **2 недели** после публикации посадочных и sitemap откройте KPI-дашборд.
- Сверьте кластеры A–D с `docs/seo/semantic-map.md`.
- Проверьте «Товарные сниппеты» и ошибки микроразметки в обоих кабинетах.

## Связанные документы

- `docs/seo/semantic-map.md` — семантика и URL
- `docs/seo/indexation-rules.md` — robots/canonical
