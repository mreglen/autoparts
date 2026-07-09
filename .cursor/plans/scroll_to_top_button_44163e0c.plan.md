---
name: Scroll to top button
overview: Добавить компактную плавающую кнопку «наверх» на страницах каталога б/у, новых запчастей и «Мои запчасти» — появляется при прокрутке вниз, плавно возвращает к началу.
todos:
  - id: scroll-top-component
    content: Создать ScrollToTopButton.jsx с логикой видимости и стилями
    status: completed
  - id: scroll-top-mount
    content: Подключить в AutoParts.jsx и MyParts.jsx
    status: completed
  - id: scroll-top-qa
    content: Проверить позицию на мобиле над bottom nav и reduced-motion
    status: completed
isProject: false
---

# Кнопка «наверх» на длинных списках

## Где нужна

| Маршрут | Компонент | Layout |
|---------|-----------|--------|
| `/autoparts/used` | [`AutoParts.jsx`](frontend/my-autoparts/src/pages/AutoParts/AutoParts.jsx) | MainLayout |
| `/autoparts/new` | тот же `AutoParts` | MainLayout |
| `/my-parts` | [`MyParts.jsx`](frontend/my-autoparts/src/pages/MyParts/MyParts.jsx) | ProfileWithMenuLayout |

Прокрутка — **оконная** (`window.scrollY`), отдельного scroll-контейнера нет. На мобиле снизу фиксирован [`MobileBottomNav`](frontend/my-autoparts/src/components/MobileBottomNav/MobileBottomNav.jsx) (`z-50`, `pb-[4.5rem]` у layout) — кнопку разместить **выше** нижней панели.

Готового компонента в проекте нет.

---

## Решение: переиспользуемый `ScrollToTopButton`

**Новый файл:** `frontend/my-autoparts/src/components/ScrollToTopButton/ScrollToTopButton.jsx`

### Поведение

- Слушает `window` scroll (passive listener)
- Показывается при `scrollY > 320` (порог настраиваемый пропом)
- Клик → `window.scrollTo({ top: 0, behavior: 'smooth' })`
- `aria-label="Наверх"`

### Внешний вид (компактный, в стиле сайта)

- Круг **36×36px**, `rounded-full`
- Фон `bg-white/95 backdrop-blur`, обводка `ring-1 ring-gray-200/80`, тень `shadow-md`
- Иконка стрелки вверх `h-4 w-4 text-indigo-600`
- Hover: `hover:bg-indigo-50 hover:ring-indigo-200`
- Появление: `opacity` + `translate-y` transition (~200ms), без навязчивой анимации
- Позиция: `fixed right-4 z-40`
  - Мобиль: `bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]` — над bottom nav
  - Десктоп: `lg:bottom-8`

```mermaid
flowchart TB
  scroll[scrollY больше 320px]
  visible[Кнопка видна]
  click[Клик]
  top[window.scrollTo smooth top 0]

  scroll --> visible
  visible --> click --> top
```

### Хук (опционально inline)

Логику видимости можно вынести в `useScrollToTopVisible(threshold)` в том же файле или [`hooks/useScrollToTopVisible.js`](frontend/my-autoparts/src/hooks/useScrollToTopVisible.js).

---

## Подключение

1. **[`AutoParts.jsx`](frontend/my-autoparts/src/pages/AutoParts/AutoParts.jsx)** — `<ScrollToTopButton />` в корне return (покрывает и used, и new вкладки).
2. **[`MyParts.jsx`](frontend/my-autoparts/src/pages/MyParts/MyParts.jsx)** — `<ScrollToTopButton />` в конце разметки списка.

Не добавлять в layouts глобально — только на указанных страницах, чтобы не мешать на `/part/`, чатах и т.д.

---

## Чеклист проверки

- `/autoparts/used` — после скролла вниз на 200+ карточек кнопка появляется; клик — плавный возврат наверх
- `/autoparts/new` — то же на лендинге и в результатах поиска
- `/my-parts` — то же на длинном списке склада
- Мобиль (375px): кнопка не перекрывает bottom nav
- Десктоп: кнопка справа внизу, не мешает контенту
- Вверху страницы (scrollY ≈ 0) — кнопка скрыта
- Клавиатура / reduced motion: при `prefers-reduced-motion` — `behavior: 'auto'` вместо smooth
