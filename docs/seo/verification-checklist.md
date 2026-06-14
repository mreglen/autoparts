# Чеклист: как проверить, что SEO-изменения работают (без накрутки)

Легальные способы убедиться, что технические и контентные правки «Свой Гараж» дают эффект.  
Не используйте ботов, накрутку просмотров и искусственный CTR — они искажают метрики и могут навредить сайту.

**Связанные документы:** [semantic-map.md](semantic-map.md), [indexation-rules.md](indexation-rules.md), [implementation-summary.md](implementation-summary.md).

---

## Когда запускать проверки

| Момент | Что проверять |
|--------|----------------|
| **Сразу после деплоя** | Техника: meta, prerender, sitemap, 404, мобильная вёрстка |
| **Через 3–7 дней** | Обход ботами: prerender, новые URL в sitemap |
| **Через 2–4 недели** | Первые сигналы в поиске (позиции, показы) |
| **Ежемесячно** | Рост индекса, кластеры A–D, конверсии с SEO-страниц |

---

## 1. Техническая проверка (день 0)

### 1.1 Страница открывается и не в noindex

Для каждого типа URL из [indexation-rules.md](indexation-rules.md):

- `/autoparts/new/brand/{slug}`
- `/autoparts/new/category/{slug}`
- `/autoparts/used/brand|category|geo/{slug}`
- `/part/{id}-…`, `/autoparts/new/part/{id}-…`

**Проверка в браузере (DevTools → Elements):**

- `<title>` и `<meta name="description">` заполнены, без дублей
- `<link rel="canonical">` = чистый URL без `?utm_` и лишних фильтров
- `<meta name="robots" content="index, follow">` на indexable-страницах
- На фильтрованных листингах (`?q=`, `?brand=`) — `noindex, follow`

**Ожидание после последних правок посадочных:**

- Блоки «О разделе», «Заказ и доставка», FAQ, «Популярные запросы»
- Одна строка хлебных крошек (без дубля из layout)
- На category landing — «Похожие категории»

### 1.2 Prerender для ботов

Эндпоинт: `GET /public/page-prerender?path=/autoparts/used/brand/bosch`  
(с заголовком internal prerender token, как настроено в nginx — см. `docs/nginx/svoygarage.conf`).

**В HTML ответа должны быть:**

- `<h1>`, описание, секции контента и FAQ (`<details>`)
- Ссылки на карточки / популярные запросы
- Crosslinks (бренды, категории, geo)
- В `<head>`: JSON-LD `BreadcrumbList` и `FAQPage`

Сравните с тем, что видит пользователь в SPA — смысл текста должен совпадать.

### 1.3 Sitemap

- Открыть `https://svoygarage.ru/sitemap.xml`
- Убедиться, что дочерние файлы отдают 200: `sitemap-new-parts.xml`, `sitemap-products.xml`, `sitemap-new-brands.xml`, landings used/new
- В админке **Аналитика → SEO** пересобрать cache sitemap после крупных изменений каталога

**Критерий:** новые посадочные и топ-карточки попадают в соответствующий sitemap в течение суток после seed/синка.

### 1.4 robots.txt

Файл: `frontend/my-autoparts/public/robots.txt`

- Indexable разделы разрешены (`/part/`, `/autoparts/`, `/organizations`)
- Кабинеты и фильтры закрыты (`/seller/`, `/find`, `*/filters`)
- `Sitemap: https://svoygarage.ru/sitemap.xml`

### 1.5 Структурированные данные

- [validator.schema.org](https://validator.schema.org/) — вставить URL карточки и посадочной
- Ожидаемые типы: `Product`, `BreadcrumbList`, `FAQPage`, `CollectionPage` / `ItemList` на landings

---

## 2. Контент и UX (день 0–3)

### 2.1 Посадочные

Для 3–5 эталонных URL (по одному на kind: brand new/used, category, geo):

| Критерий | Как проверить |
|----------|----------------|
| Объём текста | API `GET /public/seo/landings/{kind}/{slug}` → поле `content.about_html` + FAQ ≥ ~300 слов суммарно |
| Override intro | Если в админке задан `intro_html` — он заменяет авто-блок «О разделе» |
| FAQ | ≥ 3 вопроса, accordion открывается на mobile (tap ≥ 44px) |
| Popular queries | До 12 chip-ссылок на реальные карточки |
| Каталог | Grid 1 col на mobile, pagination работает |

### 2.2 Организации

- `/organizations/{id}` — секция «Бренды в каталоге»
- Ссылка ведёт на `/autoparts/used?organization_id=…&brand=…`
- На листинге б/у — баннер «Показаны запчасти продавца …»

### 2.3 Перелинковка

- С карточки б/у → brand landing, org, new analog (если есть)
- С главной → блок «Популярные каталоги» (`featured-landings`)
- С brand landing → counterpart (new↔used), категории

---

## 3. Индексация (неделя 1–3)

Без накрутки индексацию смотрят так:

### 3.1 Поиск по site: (ручная проверка)

В обычном браузере (инкognito), раз в неделю:

```
site:svoygarage.ru bosch
site:svoygarage.ru autoparts/new/brand
site:svoygarage.ru part/
```

**Фиксируйте в таблице:** дата, запрос, есть ли нужный URL в первых 2–3 страницах выдачи site:

### 3.2 Сверка sitemap vs site:

1. Взять 20 URL из sitemap (случайно: 10 карточек + 5 landings + 5 static)
2. Для каждого: `site:svoygarage.ru {path}` или точный title в кавычках
3. Доля проиндексированных ≈ KPI (цель — рост неделя к неделе, не 100% сразу)

### 3.3 Логи nginx (если есть доступ)

Раз в неделю:

```bash
# Пример: топ URL, которые обходят боты
grep -i "bot\|yandex\|google" access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head -30
```

**Смотреть:** боты ходят на новые `/autoparts/*/brand/` и `/part/`, а не только на `/`.

---

## 4. Позиции по семантике (неделя 2–8)

Используйте [semantic-map.md](semantic-map.md) — минимум **10 запросов на кластер** раз в 2 недели.

| Кластер | Пример запроса | Целевой URL |
|---------|----------------|-------------|
| A | `mann w712/75 купить` | new/used card |
| B | `б/у запчасти bosch` | `/autoparts/used/brand/bosch` |
| C | `б/у тормозные колодки` | category used |
| D | `б/у запчасти екатеринбург` | geo landing |

### 4.1 Ручная проверка (бесплатно)

- Инкognito, регион Екатеринбург (или VPN только для **просмотра** выдачи, без кликов по своему сайту)
- Записать: позиция (1–10 / 11–30 / 30+ / нет), какой URL ранжируется

### 4.2 Сторонние сервисы (легально)

Serpstat, Rush Analytics, Keys.so, Topvisor — история позиций без имитации кликов.

**Не делать:** автоклик по своему сайту в выдаче.

### 4.3 Админка (если подключены GSC / Яндекс Вебмастер)

**Аналитика → SEO → KPI** (`SeoKpiDashboard.jsx`):

- Показы и клики по кластерам A–D
- Сравнение двух периодов (14 vs 14 дней)
- Топ-запросы с landing URL

Подключение — по [webmaster-setup.md](webmaster-setup.md). Это опционально, но самый точный источник «показы/клики/CTR».

---

## 5. Реальный трафик (не боты)

SEO «работает», если растёт **органический** и **реферальный** трафик на целевые страницы.

### 5.1 Источники без накрутки

| Канал | Что смотреть |
|-------|--------------|
| Avito → ссылки на `/part/…` | UTM не обязателен; рост переходов в Метрике/GA |
| Прямые заходы на brand landing | Рост после seed + контента |
| 2GIS / org page | Переходы на `/organizations/{id}` |

### 5.2 Метрики на SEO-landing (Метрика / GA / Matomo)

- Входы на `/autoparts/*/brand/`, `/part/`
- Показатель отказов < 70% (ориентир для каталога)
- Глубина: переход в карточку или корзину (new)
- Для b/u: клик «написать продавцу» / время на странице

### 5.3 A/B по контенту (легально)

В админке **SEO → Посадочные** задать `intro_html` для топ-3 landings и через 4 недели сравнить:

- время на странице
- переходы в каталог с этой посадочной
- позиции по 3–5 брендовым запросам

---

## 6. Объём индекса (ongoing)

Отслеживать в админке SEO / sitemap counters:

| Метрика | Где | Здоровый тренд |
|---------|-----|----------------|
| URL в `sitemap-new-parts.xml` | SEO admin | Рост после sync Rossko |
| URL в `sitemap-products.xml` | SEO admin | Стабильный рост (лимит в `.env`) |
| Число landings | `seo_landing_pages` | После seed-from-catalog |
| SEO-карточки new | sync stats | `NEW_PARTS_SEO_SYNC_DAILY_LIMIT` |

**Правило:** не гнаться за количеством thin URL; каждая карточка должна иметь title, описание, цену (new), фото (used).

---

## 7. Регресс после деплоя (smoke, 15 минут)

Чеклист перед/после каждого SEO-релиза:

- [ ] `GET /public/seo/landings/brand_used/bosch` → 200, поле `content` не пустое
- [ ] `GET /public/seo/landings/category_new/{slug}/crosslinks` → есть `related_categories` (без self)
- [ ] `GET /public/organizations/{id}/catalog-summary` → brands[]
- [ ] Главная → блок «Популярные каталоги»
- [ ] `/autoparts/used?organization_id=X` → фильтр работает, баннер виден
- [ ] View-source / prerender: FAQ + breadcrumbs JSON-LD
- [ ] Mobile 375px: FAQ, chips, grid без горизонтального скролла
- [ ] `pytest tests/test_landing_page_content_service.py tests/test_static_page_seo_service.py` — green

---

## 8. Шаблон еженедельного отчёта (копировать в таблицу)

| Дата | URL / запрос | Индекс (site:) | Позиция | Показы* | Клики* | Примечание |
|------|--------------|----------------|---------|---------|--------|------------|
| | | | | | | |

\* — если подключён KPI-дашборд или GSC/Вебмастер.

**Итог недели (3 предложения):**

1. Что выросло в индексе / sitemap  
2. Какие кластеры (A–D) сдвинулись  
3. Что правим на следующей неделе (контент, seed, лимиты sync)

---

## 9. Чего не делать

- Накрутка просмотров, боты с ротацией IP, автоклик в выдаче  
- Сравнение «до/после» в первые 48 часов — рано для SEO  
- Паника из-за одного URL: смотреть тренд 2–4 недели  
- Игнор mobile и prerender — для вашего SPA это критично  

---

## 10. Быстрые ссылки проекта

| Что | Где |
|-----|-----|
| Семантика | [semantic-map.md](semantic-map.md) |
| Index/noindex | [indexation-rules.md](indexation-rules.md) |
| KPI дашборд | Админ → Аналитика → SEO |
| Seed landings | `POST /admin/seo/landing-pages/seed-from-catalog` |
| Контент landings | `backend/app/services/landing_page_content_service.py` |
| Prerender | `backend/app/services/static_page_seo_service.py` |
