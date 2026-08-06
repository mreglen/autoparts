# Чек-лист релиза редизайна

## Перед каждым этапом
- [ ] Desktop ≥1280px
- [ ] Mobile 360–430px
- [ ] Tablet ~768px
- [ ] PWA / safe-area (bottom nav не перекрывает CTA)
- [ ] Focus-visible на кнопках и полях
- [ ] Контраст текста ≥ AA
- [ ] `prefers-reduced-motion` не ломает UX

## Страницы
- [ ] `/` главная — поиск работает, без blur-orb / ping / gradient-text
- [ ] `/catalog` — разделы новые/б/у
- [ ] `/autoparts/new` и `/autoparts/used` — листинг
- [ ] `/part/:id` и `/autoparts/new/part/:id` — PDP, SEO meta на месте
- [ ] `/cart` и checkout
- [ ] `/dashboard` — метрики и скрытие блока задач
- [ ] Меню desktop + mobile drawer + bottom nav
- [ ] `/design-system` (только admin)
- [ ] Footer на публичных страницах
- [ ] Чаты full-height
- [ ] Автосервис planner / welcome
- [ ] Админка таблицы

## Не ломать
- [ ] URL и redirects
- [ ] Feature flags (`showNewAutoparts`, `showSiteReviews`, `showAutoservice`)
- [ ] JSON-LD / canonical
- [ ] Аналитика / Yandex badge height sync
