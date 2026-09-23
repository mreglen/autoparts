---
name: new-autoservice-page
description: Создать страницу кабинета автосервиса по эталонам проекта (таблица склада, мобильные карточки, общие классы)
---

Создай страницу `/autoservice/...` в `frontend/my-autoparts/src/pages/Autoservice/`:

1. Корень страницы: `w-full min-w-0`. НЕ добавлять `mx-auto`, `max-w-*`, `px-*` — отступы даёт общий layout (`max-lg:px-3`).
2. Десктопная таблица — эталон `/autoservice/warehouse`: только классы `autoserviceList*Class` из `src/utils/warehouseListUi.js` (`text-xs`, `py-2`, `table-fixed`, uppercase-заголовки). Строки кликабельные (`autoserviceListTrClickableClass`), действия — в модалке, без кнопок в строках.
3. Мобильная версия — карточки/строки в `div.md:hidden`, таблица в `hidden md:block`.
4. Поиск — `AutoserviceLiveSearchField`; контролы — `warehousePillControlClass` / `warehousePillButtonClass`; заголовок — `autoserviceListHeaderTitleClass`.
5. Запросы — через `apiRequest`/`apiAxios` из `utils/apiClient`.
6. Роут в `App.js` — `<AutoserviceStaffRoute section="...">`; при необходимости добавить в `AUTOSERVICE_STAFF_TABS`, `getPageTitle` и мобильное меню.
7. `npx eslint` на новом файле после создания.
