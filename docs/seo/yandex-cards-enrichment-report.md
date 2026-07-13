# Отчёт: обогащение карточек `/part/` и `/autoparts/new/part/`

## Prerender

| URL | Nginx rewrite | Backend |
|-----|---------------|---------|
| `/part/{id}-…` | `part-prerender` | `GET /public/part-prerender` → `render_product_prerender_html` |
| `/autoparts/new/part/{id}-…` | `new-part-prerender` | `GET /public/new-part-prerender` → `render_new_part_prerender_html` |

Людям отдаётся SPA; ботам (YandexBot и др.) — готовый HTML с meta, Product/FAQ JSON-LD и текстовыми блоками.

## Что сделано

- Уникальный body/summary/FAQ: цена, наличие, кол-во, город, продавец, fitment, № объявления.
- New-карточки дотянуты до used: About, fitment, склады/доставка, б/у-ссылки, richer prerender.
- Пустые new-карточки: `noindex, follow` + исключение из sitemap (нужно реальное наличие).
- Inspection checklist для new без «б/у»-шага; кросс-ссылки для new-карточек.

## Уже можно сейчас (из текущего)

1. После деплоя — пересобрать sitemap (products + new-parts) в админке SEO.
2. В Яндекс.Вебмастере отправить на переобход LOW_DEMAND / малоценные URL.
3. Микротест 3–5 карточек used и new (Product + FAQPage).
4. Добавить топ-карточки в «Важные страницы».

## Идеально дальше

| Идея | Зачем | Нужно |
|------|--------|--------|
| Одна каноническая страница на brand+article (остальные `noindex`/canonical) | Сильнее режет дубли | Продуктовое решение + редиректы |
| Уникальные описания продавцов / AI batch | Меньше шаблонности | Контент + модерация |
| AggregateRating / отзывы в schema | Богаче сниппет | Сбор отзывов |
| Мониторинг убыли индекса (100–200/день) | Контроль | Выгрузки Вебмастера по расписанию |
