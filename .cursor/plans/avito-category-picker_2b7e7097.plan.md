---
name: avito-category-picker
overview: Добавить в /settings/integration ручной выбор категории из дерева Авито для строк XLSX, с записью выбранной категории обратно в XLSX и обновлением кэша/таблицы.
todos:
  - id: backend-tree-endpoint
    content: Добавить Avito API вызов дерева и GET /avito/autoload/category-tree (с кешем)
    status: completed
  - id: backend-set-category
    content: "Добавить POST /avito/autoload/set-category: записать категорию в XLSX, перепарсить, обновить кэш, вернуть items"
    status: completed
  - id: frontend-picker-modal
    content: Сделать кликабельную колонку «Категория» и CategoryPickerModal с деревом категорий
    status: completed
  - id: frontend-save-category
    content: По выбору категории дергать set-category и обновлять items в таблице без перезагрузки
    status: completed
isProject: false
---

## Цель
- В модалке объявлений на странице интеграции Авито дать возможность **кликнуть по ячейке «Категория»** и выбрать категорию из дерева Авито.
- После выбора категория **записывается в XLSX в колонку «Категория»** для выбранной строки и таблица обновляется без перезагрузки.
- Оплату/публикацию не трогаем.

## Текущее состояние (что есть)
- Таблица объявлений в `[frontend/my-autoparts/src/pages/Settings/IntegrationPage.jsx](frontend/my-autoparts/src/pages/Settings/IntegrationPage.jsx)` показывает `row.category` как текст и не даёт редактировать.
- Бэкенд хранит кэш распарсенных строк в `OrganizationAvitoAutoloadCache.items_json` и обновляет XLSX через роуты в `[backend/app/routers/avito_integration.py](backend/app/routers/avito_integration.py)`.
- В `avito_api.py` уже есть получение OAuth токена, но **нет** вызова `GET /autoload/v1/user-docs/tree`.

## Дизайн решения
### Backend
1) **Прокси-эндпоинт дерева категорий**
- Добавить в `[backend/app/services/avito_api.py](backend/app/services/avito_api.py)` функцию `get_autoload_user_docs_tree(access_token)` (GET `https://api.avito.ru/autoload/v1/user-docs/tree`).
- Добавить в `[backend/app/routers/avito_integration.py](backend/app/routers/avito_integration.py)` эндпоинт:
  - `GET /organizations/{org_id}/avito/autoload/category-tree`
  - Берёт интеграционные креды организации → получает токен → возвращает JSON дерева (как отдаёт Авито) + минимально нормализованный формат (см. ниже).
  - Добавить простое кэширование в памяти процесса на 10–30 минут (чтобы не бить API при каждом открытии модалки).

2) **Эндпоинт для записи категории в XLSX**
- Добавить эндпоинт:
  - `POST /organizations/{org_id}/avito/autoload/set-category`
  - Body: `{ sheet: string, row: number, category: string }`
  - Логика:
    - найти сохранённый `autoload.xlsx` по `OrganizationAvitoAutoloadCache.saved_path`
    - открыть workbook, найти колонку `Категория` по строке заголовков (row 2)
    - записать `category` в указанную строку/колонку
    - сохранить XLSX обратно
    - прогнать `parse_and_validate_avito_autoload()` и обновить `items_json`, `local_validation_ok`, `local_errors_json`, `sheets_parsed_json`
    - вернуть тот же формат, что `/autoload/upload`: `{ saved_path, items, local_validation_ok, local_errors, sheets_parsed }`

> Важно: мы **не пишем slug/ID**, только название в колонку «Категория» (по вашему последнему подтверждению).

### Frontend
1) **UI: кликабельная категория + модалка дерева**
- В таблице модалки объявлений заменить ячейку категории:
  - вместо текста → кнопка/ссылка (даже если `-`), по клику открывает `CategoryPickerModal`.
- `CategoryPickerModal`:
  - при открытии делает запрос на `GET /organizations/{orgId}/avito/autoload/category-tree`
  - строит дерево (рекурсивный список, раскрытие узлов)
  - по клику на листовой/любой категории — возвращает выбранное **название категории**.

2) **Сохранение выбора**
- После выбора модалка вызывает `POST /organizations/{orgId}/avito/autoload/set-category` с `{sheet,row,category}`.
- По ответу обновляет `items` в стейте (`setItems(data.items)`), чтобы таблица сразу показала новую категорию.
- Повторный клик по категории снова открывает выбор.

## Нормализация дерева (минимум)
- Если ответ Авито сложный/вложенный, на бэкенде привести к виду:
  - `[{ title: string, children: [...] }]`
- Фронту отдавать уже нормализованное дерево, чтобы не зависеть от точного формата Авито.

## Точки проверки
- Загрузить проблемный XLSX → открыть модалку объявлений → у строк без категории кликнуть «-» → выбрать категорию → увидеть:
  - категория появилась в таблице
  - повторное открытие файла/страницы сохраняет категорию (потому что записано в XLSX и кэш обновлён)
- Проверить, что `local_errors`/`local_validation_ok` отображаются как раньше (мы их не ломаем).
