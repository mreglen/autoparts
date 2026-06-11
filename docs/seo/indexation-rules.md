# Правила индексации «Свой Гараж»

Согласовано с [`pageSeo.js`](../../frontend/my-autoparts/src/utils/pageSeo.js) (клиентский Helmet) и [`static_page_seo_service.py`](../../backend/app/services/static_page_seo_service.py) (prerender для ботов).

## Общие принципы

- Листинги с **фильтрами в query** (`?q=`, `?brand=`, `?sort=`, `?in_stock=`) — **noindex, follow**, canonical на «чистый» раздел или посадочную.
- Посадочные **brand / category / geo** — **index, follow**, один canonical без query-параметров.
- Карточки товаров и SEO-карточки новых запчастей — **index, follow**.

## Таблица URL-паттернов

| URL-паттерн | robots | canonical | Где задаётся |
|-------------|--------|-----------|--------------|
| `/` | index, follow | `/` | `buildHomeSeo` / `_build_home_seo` |
| `/catalog` | index, follow | `/catalog` | `buildCatalogSeo` |
| `/autoparts/new` | index, follow | `/autoparts/new` | `buildNewPartsSeo` |
| `/autoparts/new?q=…` | noindex, follow | `/autoparts/new` | `buildNewPartsSeo` |
| `/autoparts/new?brand=…` | noindex, follow | `/autoparts/new/brand/{slug}` если один бренд | `buildNewPartsSeo` + `resolveBrandLandingCanonical` |
| `/autoparts/new/brand/{slug}` | index, follow | self | landing page SEO helpers |
| `/autoparts/new/category/{slug}` | index, follow | self | landing page SEO helpers |
| `/autoparts/new/part/{id}-…` | index, follow | self | `NewPartDetailPage` / prerender |
| `/autoparts/used` | index, follow | `/autoparts/used` | `buildUsedPartsSeo` |
| `/autoparts/used?q=…` | noindex, follow | `/autoparts/used` | `buildUsedPartsSeo` |
| `/autoparts/used?brand=…` | noindex, follow | `/autoparts/used/brand/{slug}` если один бренд | `buildUsedPartsSeo` + `resolveBrandLandingCanonical` |
| `/autoparts/used/brand/{slug}` | index, follow | self | `usedPartsBrandSeo` |
| `/autoparts/used/category/{slug}` | index, follow | self | `usedPartsCategorySeo` |
| `/autoparts/used/geo/{slug}` | index, follow | self | `usedPartsGeoSeo` |
| `/part/{id}-…` | index, follow | self | `buildProductSeo` / part prerender |
| `/seller/part-card/{id}` | noindex, follow | `/part/…` | `buildSellerPartCardSeo` |
| `/about`, `/delivery`, `/organizations` | index, follow | self | static SEO builders |

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
