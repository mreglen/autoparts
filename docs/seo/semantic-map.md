# Семантическая карта «Свой Гараж»

Справочник для SEO-команды: кластеры запросов → целевые URL и шаблоны meta.  
Актуальные slug брендов/категорий — в админке **SEO → Посадочные** или через seed `POST /admin/seo/landing-pages/seed-from-catalog`.

**Geo-посадочная:** `/autoparts/used/geo/ekaterinburg` (не `/city/`).

---

## Кластер A — Карточки (высокий intent)

| # | Запрос (пример) | Целевой URL | Шаблон title |
|---|-----------------|-------------|--------------|
| 1 | bosch 0986424590 купить | `/autoparts/new/part/{id}-bosch-0986424590` | `{brand} {article} от {price} — новая \| Свой Гараж` |
| 2 | bosch 0986424590 цена | то же | то же |
| 3 | 0986424590 оригинал | new card | то же |
| 4 | mann w712/75 купить | new/used card по наличию | `{brand} {article} от {price} — {new/б/у} \| Свой Гараж` |
| 5 | ngk 96535 цена | new card | то же |
| 6 | febi 37424 купить екатеринбург | new card | то же |
| 7 | купить тормозные колодки bosch | `/autoparts/new/category/tormoznye-kolodki` или card | category / card title |
| 8 | артикул 34116761280 bmw | `/part/{id}-…` если б/у | `{brand} {article} от {price} — б/у \| Свой Гараж` |
| 9 | оригинал масляный фильтр mann | new card | card title |
| 10 | запчасть hyundai 2630035504 | new card | card title |
| 11 | knecht ox188 купить | new card | card title |
| 12 | sakura fc1101 цена | new card | card title |
| 13 | б/у генератор bosch | `/part/{id}-…` | б/у card title |
| 14 | амортизатор kayaba 334001 | new card | card title |
| 15 | рулевая рейка б/у | `/autoparts/used/category/rulevoe-upravlenie` | category used title |
| 16 | свечи зажигания ngk купить | `/autoparts/new/brand/ngk` | brand new title |
| 17 | фильтр салона угольный mann | new card | card title |
| 18 | помпа водяная graf купить | new card | card title |

---

## Кластер B — Бренды (средний intent)

| # | Запрос | URL new | URL used |
|---|--------|---------|----------|
| 19 | новые запчасти bosch | `/autoparts/new/brand/bosch` | — |
| 20 | б/у запчасти bosch | — | `/autoparts/used/brand/bosch` |
| 21 | bosch автозапчасти | `/autoparts/new/brand/bosch` | `/autoparts/used/brand/bosch` |
| 22 | новые запчасти mann-filter | `/autoparts/new/brand/mann-filter` | — |
| 23 | б/у mann filter | — | `/autoparts/used/brand/mann-filter` |
| 24 | ngk автозапчасти | `/autoparts/new/brand/ngk` | `/autoparts/used/brand/ngk` |
| 25 | febi bilstein запчасти | `/autoparts/new/brand/febi` | `/autoparts/used/brand/febi` |
| 26 | новые запчасти mahle | `/autoparts/new/brand/mahle` | — |
| 27 | б/у запчасти denso | — | `/autoparts/used/brand/denso` |
| 28 | sachs автозапчасти купить | `/autoparts/new/brand/sachs` | `/autoparts/used/brand/sachs` |
| 29 | lemforder б/у | — | `/autoparts/used/brand/lemforder` |
| 30 | новые запчасти valeo | `/autoparts/new/brand/valeo` | — |
| 31 | brembo тормозные | `/autoparts/new/brand/brembo` | `/autoparts/used/brand/brembo` |
| 32 | запчасти hyundai-kia оригинал | `/autoparts/new/brand/hyundai` | `/autoparts/used/brand/hyundai` |
| 33 | toyota запчасти новые | `/autoparts/new/brand/toyota` | — |
| 34 | б/у запчасти volkswagen | — | `/autoparts/used/brand/volkswagen` |
| 35 | ford автозапчасти каталог | `/autoparts/new/brand/ford` | `/autoparts/used/brand/ford` |

---

## Кластер C — Категории

| # | Запрос | URL new | URL used | Примечание |
|---|--------|---------|----------|------------|
| 36 | новые тормозные колодки купить | `/autoparts/new/category/tormoznye-kolodki` | — | |
| 37 | б/у тормозные колодки | — | `/autoparts/used/category/tormoznye-kolodki` | |
| 38 | масляный фильтр купить | `/autoparts/new/category/maslyanyj-filtr` | `/autoparts/used/category/maslyanyj-filtr` | |
| 39 | новые амортизаторы | `/autoparts/new/category/amortizatory` | — | slug из seed |
| 40 | б/у амортизаторы | — | `/autoparts/used/category/amortizatory` | |
| 41 | тормозные диски новые | `/autoparts/new/category/tormoznye-diski` | — | |
| 42 | б/у тормозные диски | — | `/autoparts/used/category/tormoznye-diski` | |
| 43 | свечи зажигания купить | `/autoparts/new/category/svechi-zazhiganiya` | `/autoparts/used/category/svechi-zazhiganiya` | |
| 44 | ремень грм новый | `/autoparts/new/category/remen-grm` | — | |
| 45 | генератор б/у | — | `/autoparts/used/category/generator` | |
| 46 | стартер купить б/у | — | `/autoparts/used/category/starter` | |
| 47 | тормозные колодки toyota | `/autoparts/new/category/tormoznye-kolodki?vb=Toyota` | noindex → category | combo: noindex |
| 48 | фильтр воздушный hyundai | `/autoparts/new/category/vozdushnyj-filtr?vb=Hyundai` | noindex | combo |
| 49 | крыло б/у | — | `/autoparts/used/category/krylo` | |
| 50 | бампер передний б/у | — | `/autoparts/used/category/bamper` | |
| 51 | новые фильтры салона | `/autoparts/new/category/filtr-salona` | — | |
| 52 | рулевое управление б/у | — | `/autoparts/used/category/rulevoe-upravlenie` | |

---

## Кластер D — Гео (Екатеринбург)

| # | Запрос | Целевой URL |
|---|--------|-------------|
| 53 | автозапчасти екатеринбург | `/` + `/about` + `/organizations` |
| 54 | б/у запчасти екатеринбург | `/autoparts/used/geo/ekaterinburg` |
| 55 | новые автозапчасти екатеринбург | `/autoparts/new` (город в description карточек) |
| 56 | разборка екатеринбург запчасти | `/autoparts/used/geo/ekaterinburg` |
| 57 | автозапчасти екатеринбург купить | `/autoparts/used/geo/ekaterinburg` |
| 58 | магазин автозапчастей екатеринбург | `/organizations` |
| 59 | запчасти для иномарок екатеринбург | `/autoparts/new` + `/autoparts/used` |
| 60 | автозапчасти свердловская область | `/delivery` + geo landing |

---

## Перелинковочная матрица (код)

| От | К | Реализация |
|----|---|------------|
| Главная | brand landings (new + used) | `Main.jsx` → `/public/seo/featured-landings` |
| Brand landing | top cards + category landings + counterpart (new↔used) | `SeoLandingCrossLinks` |
| Category landing | brand landings + top cards + counterpart | `SeoLandingCrossLinks` |
| New card | used matches + analogs + brand landing | `NewPartDetailPage` + `NewPartUsedMatchesBlock` |
| Used card | new analog + brand landing + seller org | `PartDetailSeoCrossLinks` + org link |

---

## KPI по кластерам

Мониторинг в админке **Аналитика → SEO → KPI** (Yandex Webmaster + Google Search Console API):

- **A:** запросы с артикулом / «купить» / «цена»
- **B:** «{brand} автозапчасти», «новые/б/у запчасти {brand}»
- **C:** «{категория} купить», «б/у {категория}»
- **D:** «екатеринбург», «автозапчасти {город}»

Метрики: показы, клики, CTR, средняя позиция; сравнение URL в sitemap vs проиндексировано.
