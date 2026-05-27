# SEO: заголовки карточек товаров (/part/…)

## Почему в Яндексе только «Свой Гараж»

Сайт — SPA (React). Nginx отдаёт один `index.html` с дефолтным `<title>Свой Гараж</title>`.
Название запчасти подставляется **после загрузки JS** (`react-helmet-async`).

Робот Яндекса часто берёт заголовок из **первого HTML**, без ожидания API — в выдаче остаётся «Свой Гараж», хотя ссылка ведёт на нужную карточку.

## Решение в проекте

1. **Backend** — `GET /api/public/part-prerender?path=/part/123-BRAND-ARTICLE`  
   HTML с `<title>Бренд Артикул … | Свой Гараж</title>`, description, canonical, JSON-LD.

2. **Nginx** — для User-Agent поисковых ботов `/part/…` проксируется на этот endpoint.

3. **Frontend** — пока грузится товар, в `<title>` сразу подставляются бренд и артикул из URL.

## Деплой nginx

В `server { … }` для svoygarage.ru **перед** `location /` добавьте блоки из `docs/nginx/svoygarage.conf` (секция SEO /part/).

Проверка:

```bash
curl -s -A "YandexBot" "https://svoygarage.ru/part/ID-BRAND-ARTICLE" | head -20
# в ответе должен быть <title>Бренд Артикул … | Свой Гараж</title>
```

## После выкладки

В [Яндекс Вебмастер](https://webmaster.yandex.ru/) — переобход URL карточки или раздела.  
Обновление сниппета в поиске может занять от нескольких дней до 2–4 недель.

## Отладка

```bash
curl -s "http://127.0.0.1:8080/api/public/part-meta?path=/part/123-BOSCH-0123456789"
```
