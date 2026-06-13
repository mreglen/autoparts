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
| `/catalog` | index, follow | `/catalog` | — | `buildCatalogSeo` |
| `/autoparts/new` | index, follow | `/autoparts/new` | — | `buildNewPartsSeo` |
| `/autoparts/new?q=…` | noindex, follow | `/autoparts/new` | — | `buildNewPartsSeo` |
| `/autoparts/new?brand=…` | noindex, follow | `/autoparts/new/brand/{slug}` если один бренд | — | `buildNewPartsSeo` + `resolveBrandLandingCanonical` |
| `/autoparts/new/brand/{slug}` | index, follow | self | авто, `buildPageKeywords` | landing page SEO helpers |
| `/autoparts/new/category/{slug}` | index, follow | self | авто, `buildPageKeywords` | landing page SEO helpers |
| `/autoparts/new/part/{id}-…` | index, follow | self | авто, `buildPageKeywords` | `NewPartDetailPage` / prerender |
| `/autoparts/used` | index, follow | `/autoparts/used` | — | `buildUsedPartsSeo` |
| `/autoparts/used?q=…` (произвольный) | noindex, follow | `/autoparts/used` | — | `buildUsedPartsSeo` |
| `/autoparts/used?q={brand} {article}` (канонический запрос рабочей карточки) | index, follow | self (`/autoparts/used?q=…`) | авто, `buildPageKeywords` | `_build_used_parts_seo` + resolver |
| `/autoparts/used?brand=…` | noindex, follow | `/autoparts/used/brand/{slug}` если один бренд | — | `buildUsedPartsSeo` + `resolveBrandLandingCanonical` |
| `/autoparts/used/brand/{slug}` | index, follow | self | авто, `buildPageKeywords` | `usedPartsBrandSeo` |
| `/autoparts/used/category/{slug}` | index, follow | self | авто, `buildPageKeywords` | `usedPartsCategorySeo` |
| `/autoparts/used/geo/{slug}` | index, follow | self | авто, `buildPageKeywords` | `usedPartsGeoSeo` |
| `/part/{id}-…` | index, follow | self | авто, `buildPageKeywords` | `buildProductSeo` / part prerender |
| `/seller/part-card/{id}` | noindex, follow | `/part/…` | — | `buildSellerPartCardSeo` |
| `/about`, `/delivery`, `/organizations` | index, follow | self | — | static SEO builders |

**keywords:** автогенерация через [`page_keywords.py`](../../backend/app/utils/page_keywords.py) / [`pageKeywords.js`](../../frontend/my-autoparts/src/utils/pageKeywords.js). На **noindex**-страницах тег `<meta name="keywords">` **не выводится**.

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
