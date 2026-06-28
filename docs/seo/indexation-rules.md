# Правила индексации «Свой Гараж»

Согласовано с [`pageSeo.js`](../../frontend/my-autoparts/src/utils/pageSeo.js) (клиентский Helmet) и [`static_page_seo_service.py`](../../backend/app/services/static_page_seo_service.py) (prerender для ботов).

## Общие принципы

- Листинги с **фильтрами в query** (`?q=`, `?brand=`, `?sort=`, `?in_stock=`) — **noindex, follow**, canonical на «чистый» раздел или посадочную.
- Посадочные **brand / category / geo** — **index, follow**, один canonical без query-параметров.
- Карточки товаров и SEO-карточки новых запчастей — **index, follow**.

## Таблица URL-паттернов

| URL-паттерн | robots | canonical | keywords | Где задаётся |
|-------------|--------|-----------|----------|--------------|
| `/` | index, follow | `/` | — | `buildHomeSeo` / `_build_home_seo` |
| `/find?q=…` | noindex, follow | `/find` | — | `buildFindSeo` + `resolve-all` redirect |
| `/catalog` | index, follow | `/catalog` | — | `buildCatalogSeo` |
| `/autoparts/new` | index, follow | `/autoparts/new` | — | `buildNewPartsSeo` |
| `/autoparts/new?q=…` | noindex, follow | `/autoparts/new` | — | `buildNewPartsSeo` |
| `/autoparts/new?brand=…` | noindex, follow | `/autoparts/new/brand/{slug}` если один бренд | — | `buildNewPartsSeo` + `resolveBrandLandingCanonical` |
| `/autoparts/new/brand/{slug}` | index, follow | self | авто, `buildPageKeywords` | landing page SEO helpers |
| `/autoparts/new/category/{slug}` | index, follow | self | авто, `buildPageKeywords` | landing page SEO helpers |
| `/autoparts/new/part/{id}-…` | index, follow | self | авто, `buildPageKeywords` | `NewPartDetailPage` / prerender |
| `/autoparts/used` | index, follow | `/autoparts/used` | — | `buildUsedPartsSeo` |
| `/autoparts/used?q=…` (произвольный) | noindex, follow | `/autoparts/used` | — | `buildUsedPartsSeo` |
| `/autoparts/used?q={brand} {article}` (канонический запрос рабочей карточки) | index, follow | `build_product_used_catalog_url` (обычно `бренд артикул`) | авто, `buildPageKeywords` | `_build_used_parts_seo` + resolver |
| `/autoparts/used?q={article}` (уникальный нормализованный артикул) | index, follow | `build_product_used_catalog_url` | авто, `buildPageKeywords` | `_build_used_parts_seo` + resolver |
| `/autoparts/used?q={name}` (уникальное точное название) | index, follow | `build_product_used_catalog_url` | авто, `buildPageKeywords` | `_build_used_parts_seo` + resolver |
| `/autoparts/used?brand=…` | noindex, follow | `/autoparts/used/brand/{slug}` если один бренд | — | `buildUsedPartsSeo` + `resolveBrandLandingCanonical` |
| `/autoparts/used/brand/{slug}` | index, follow | self | авто, `buildPageKeywords` | `usedPartsBrandSeo` |
| `/autoparts/used/category/{slug}` | index, follow | self | авто, `buildPageKeywords` | `usedPartsCategorySeo` |
| `/autoparts/used/geo/{slug}` | index, follow | self | авто, `buildPageKeywords` | `usedPartsGeoSeo` |
| `/part/{id}-…` | index, follow | self | авто, `buildPageKeywords` | `buildProductSeo` / part prerender; обогащённый контент (О запчасти, FAQ, доставка); FAQPage JSON-LD |
| `/seller/part-card/{id}` | noindex, follow | `/part/…` | — | `buildSellerPartCardSeo` |
| `/about`, `/delivery`, `/organizations` | index, follow | self | — | static SEO builders |

**keywords:** автогенерация через [`page_keywords.py`](../../backend/app/utils/page_keywords.py) / [`pageKeywords.js`](../../frontend/my-autoparts/src/utils/pageKeywords.js). На **noindex**-страницах тег `<meta name="keywords">` **не выводится**.

## Карточки товаров `/part/` (SEO)

- **Title:** `{brand} {article} {тип|название} б/у — {город} | Свой Гараж` (без «Продавец №ID» в title; продавец остаётся в description).
- **Prerender для ботов:** блоки «О запчасти», характеристики, применимость, «Доставка и оплата», «Гарантия и осмотр», FAQ, другие предложения.
- **JSON-LD:** Product + BreadcrumbList + WebPage + FAQPage.
- **Проданный товар (`quantity=0`):** если есть другие предложения с тем же brand+article — prerender отдаёт **301** на `/autoparts/used?q={brand} {article}`; иначе 404. На фронте — экран «Продано» с альтернативами.

## После деплоя (Yandex LOW_DEMAND)

1. Пересобрать кэш sitemap товаров (админка SEO или `rebuild_products_sitemap_cache`).
2. В Яндекс.Вебмастере отправить на переобход URL из выгрузки `svoygarage.ru_a69cf727df5e35e95c48baf7.xlsx` (лист с `status=LOW_DEMAND`, ~206 карточек `/part/`).
3. Проверить несколько карточек в [Микротесте](https://webmaster.yandex.ru/tools/microtest/) — наличие FAQPage и Product.

## robots.txt

Файл: [`frontend/my-autoparts/public/robots.txt`](../../frontend/my-autoparts/public/robots.txt).

Дублирует meta robots для **crawl budget**: закрывает кабинеты (`/auth`, `/my-parts`, `/seller/`, `/admin/`), служебный редирект поиска (`/find`), зеркала карточек (`/seller/part-card/`), страницы фильтров (`/autoparts/*/filters`), корзину и служебные URL. Индексируемые разделы (`/part/`, `/autoparts/`, `/organizations`, `/delivery`) явно разрешены. `Clean-param` убирает UTM и рекламные метки из индекса Яндекса.

## Фильтр `?brand=` → canonical на посадочную

Единственный бренд в query (`brand=BOSCH`) → canonical `/autoparts/{new|used}/brand/bosch`.  
Несколько брендов или бренд + другие фильтры → canonical на `/autoparts/new` или `/autoparts/used`.

## Яндекс.Вебмастер

- Регион: **Свердловская область** (225 + регионы доставки в фиде).
- Sitemap: `https://svoygarage.ru/sitemap.xml` (индекс с products, new-parts, landings).
- «Важные страницы»: топ-100 карточек + все brand/category/geo из `seo_landing_pages`.
- Мониторинг: «Товарные сниппеты», ошибки микроразметки, [Микротест](https://webmaster.yandex.ru/tools/microtest/).

## Google Search Console

- Property: `https://svoygarage.ru/` (URL-prefix или domain).
- Sitemap: тот же индекс.
- KPI: Search Analytics API (см. админка → SEO → KPI).
