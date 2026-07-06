---
name: Yandex badge header toggle
overview: Вставить Яндекс-счётчик в самый верх шапки (десктоп и мобайл) и добавить в конце /admin-settings переключатель показа значка, сохраняемый в site_settings и отдаваемый через public-site-config.
todos:
  - id: backend-flag
    content: "site_settings: колонка show_yandex_badge + schema patch + вызов в main.py"
    status: completed
  - id: backend-api
    content: "auth.py public-site-config и admin.py (Response/Patch/GET/PATCH): пробросить show_yandex_badge"
    status: completed
  - id: redux
    content: "PublicInfoSlice: state/reducer/маппинг showYandexBadge + хук useShowYandexBadge"
    status: completed
  - id: badge-headers
    content: Вынести HTML значка; вставить в верх Navigation.jsx и MobileHeader.jsx под флагом
    status: completed
  - id: header-height
    content: Скомпенсировать высоту шапки (--sg-*-header-h / спейсеры) когда значок включён
    status: completed
  - id: admin-toggle
    content: "AdminPanelPage: стейт/загрузка/handler + карточка-переключатель в самом конце страницы"
    status: completed
isProject: false
---

# Яндекс-значок в шапке + переключатель в /admin-settings

Значок реализуем как новый boolean-флаг `show_yandex_badge`, проходящий тем же путём, что существующий `show_site_reviews`: `site_settings` (БД) → админ PATCH → `public-site-config` → Redux `publicInfo` → шапки. HTML значка берём без изменений из уже существующего [`YandexWebmasterCounter.jsx`](frontend/my-autoparts/src/components/Seo/YandexWebmasterCounter.jsx).

Значение по умолчанию: **включён** (значок виден, пока админ не выключит).

## 1. Backend: новый флаг `show_yandex_badge`

- [`backend/app/models/site_settings.py`](backend/app/models/site_settings.py): добавить колонку `show_yandex_badge = Column(Boolean, nullable=False, default=True)`.
- [`backend/app/db/schema_patches.py`](backend/app/db/schema_patches.py): добавить `ensure_site_settings_show_yandex_badge_column()` по образцу `ensure_site_settings_show_site_reviews_column` (строки ~459-477) и вызвать её из [`backend/app/main.py`](backend/app/main.py) там же, где остальные патчи.
- [`backend/app/routers/auth.py`](backend/app/routers/auth.py) (`get_public_site_config`, ~634-666): добавить в возвращаемый словарь `"show_yandex_badge": getattr(settings_row, "show_yandex_badge", True) is not False`.
- [`backend/app/routers/admin.py`](backend/app/routers/admin.py):
  - в `SiteSettingsResponse` добавить `show_yandex_badge: bool = True`;
  - в `SiteSettingsPatch` добавить `show_yandex_badge: Optional[bool] = None`;
  - в `GET /site-settings` вернуть поле;
  - в `PATCH /site-settings` добавить `if "show_yandex_badge" in data: row.show_yandex_badge = data["show_yandex_badge"]`.

## 2. Frontend: проброс флага в Redux

- [`frontend/my-autoparts/src/redux/slices/PublicInfoSlice.js`](frontend/my-autoparts/src/redux/slices/PublicInfoSlice.js): добавить `showYandexBadge` в state (default `true`), reducer `setShowYandexBadge`, и маппинг `p.show_yandex_badge` в `fetchPublicSiteConfig.fulfilled`.
- Новый хук в [`frontend/my-autoparts/src/utils/siteReviewsPublic.js`](frontend/my-autoparts/src/utils/siteReviewsPublic.js) (или отдельный файл) — `useShowYandexBadge()` по образцу `useShowSiteReviews()`.

## 3. Frontend: значок в шапках

Вынести HTML-константу значка из [`YandexWebmasterCounter.jsx`](frontend/my-autoparts/src/components/Seo/YandexWebmasterCounter.jsx) в экспорт (или создать лёгкий `HeaderYandexBadge`), чтобы вставить без обёртки `py-6`. HTML остаётся дословно тем, что прислан.

- Десктоп [`Navigation.jsx`](frontend/my-autoparts/src/pages/Navigation/Navigation.jsx): первым потомком внутри `<header>` (перед верхней полоской, ~строка 142) вставить тонкую центрированную строку со значком, обёрнутую в `showYandexBadge && (...)`.
- Мобайл [`MobileHeader.jsx`](frontend/my-autoparts/src/components/MobileHeader/MobileHeader.jsx): первым потомком внутри `<header>` (перед строкой `h-[3.75rem]`, ~строка 104) вставить ту же строку под `showYandexBadge`. Добавить сюда чтение `useShowYandexBadge()` (сейчас `MobileHeader` конфиг не читает).

### Компенсация высоты шапки
Значок добавляет ~31px строку. Чтобы контент не перекрывался фиксированной шапкой:
- либо делаем строку значка компактной и увеличиваем `--sg-desktop-header-h` / `--sg-mobile-header-h` в [`index.css`](frontend/my-autoparts/src/index.css) когда значок включён;
- проще и безопаснее: держать значок частью фиксированной шапки и синхронно поднять переменные высоты. Так как высота зависит от флага, применим CSS-класс-модификатор на `<header>`/обёртке layout, переключающий значение переменной, чтобы спейсеры и `sticky top-[var(--sg-*)]` оставались корректными.

## 4. Frontend: переключатель в /admin-settings

- [`AdminPanelPage.jsx`](frontend/my-autoparts/src/pages/Admin/AdminPanelPage.jsx):
  - локальный стейт `showYandexBadgeLocal`, инициализация из `GET /admin/site-settings` (~строки 57-68);
  - `handleToggleShowYandexBadge(checked)` по образцу `handleToggleShowSiteReviews` (~131-146): `PATCH /admin/site-settings` → `setShowYandexBadgeLocal` → `dispatch(setShowYandexBadge(checked))` → `dispatch(fetchPublicSiteConfig())`;
  - новая карточка-секция **в самом конце** (после блока «Округление цен…», ~после строки 748, перед модалкой `markupDialogOpen` на 750): `bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6` с чекбоксом того же вида: заголовок «Значок Яндекс.Вебмастер в шапке» и описание.

### Кэш конфига
`fetchPublicSiteConfig` кэширует в sessionStorage (`sg_public_site_config_v1`). Как и существующие тумблеры, синхронно диспатчим `setShowYandexBadge(checked)`, чтобы UI обновился сразу, не дожидаясь протухания кэша/CDN (public-site-config микрокэшируется nginx на 120с).

## Проверка
- Включить/выключить тумблер в `/admin-settings` → значок появляется/исчезает в десктоп- и мобайл-шапке (после локального диспатча — сразу).
- Значок ведёт на `webmaster.yandex.ru/siteinfo`, картинка `yandex.ru/cycounter`.
- Контент под шапкой не перекрывается при включённом значке (проверить главную и внутренние страницы).