---
name: avito-unified-import-export-linking
overview: "Сделать import/export Avito XLSX единым контуром: связывать строки XLSX с товарами через AvitoId (номер объявления) и internal_code, обновлять существующие строки вместо создания дублей, и при экспорте перезаписывать «Уникальный идентификатор объявления» на internal_code для строк, пришедших из Avito."
todos:
  - id: import-linking
    content: "В import_avito_autoload_rows: разрешить строки без AvitoId, добавить поиск/создание по unique_ad_id/internal_code и создание/обновление ProductAvitoListingLink при наличии AvitoId"
    status: completed
  - id: export-row-matching
    content: "В upsert_products_to_avito_autoload: добавить приоритет поиска строки по AvitoId (колонка 3) для связанных товаров, затем unique_ad_id"
    status: completed
  - id: export-overwrite-unique
    content: "При нахождении строки по AvitoId: перезаписывать col1 на internal_code, не затирать col3"
    status: completed
isProject: false
---

## Цель
- Сделать import/export Avito XLSX «единым целым»:
  - если товар уже экспортировался/импортировался — при повторном экспорте/импорте он **обновляется**, а не дублируется
  - связь с Avito живёт через **AvitoId = «Номер объявления на Авито»** (колонка 3)
  - **«Уникальный идентификатор объявления»** (колонка 1) должен в итоге быть **`Product.internal_code`** для «наших» товаров
  - если XLSX был скачан из Авито и в нём есть AvitoId, то при экспорте связанного товара мы **перезаписываем col1 на internal_code**

## Ключевые сущности
- **AvitoId**: колонка `Номер объявления на Авито` (реальный id объявления) → хранится в `ProductAvitoListingLink.avito_ad_id`.
- **UniqueAdId**: колонка `Уникальный идентификатор объявления` → используем как `Product.internal_code`.

## Изменения в парсере XLSX
Файл: `[backend/app/services/avito_autoload_xlsx.py](backend/app/services/avito_autoload_xlsx.py)`
- Убедиться, что `parse_and_validate_avito_autoload()` возвращает:
  - `unique_ad_id` (из колонки 1)
  - `avito_id` (из колонки 3)
  - (у вас это уже есть: `unique_ad_id` добавлен, `avito_id` берётся из col3/legacy)

## Единая логика IMPORT (XLSX → БД)
Файл: `[backend/app/routers/avito_integration.py](backend/app/routers/avito_integration.py)` (`import_avito_autoload_rows`)

### 1) Как ищем существующий товар
Для каждой строки:
- Если есть `AvitoId`:
  - искать `ProductAvitoListingLink` по `(organization_id, avito_ad_id)` → это главный ключ связи
  - если нашли — обновляем связанный товар
- Если `AvitoId` нет (вы выбрали разрешить импорт):
  - пробуем найти товар по `unique_ad_id` (если он похож на internal_code и не пустой) → `Product.internal_code`
  - иначе fallback: по бизнес-ключу (например OEM/артикул), если он у вас есть в данных строки

### 2) Как создаём товар
- `Product.internal_code`:
  - если в XLSX есть `unique_ad_id` и он свободен → используем его
  - иначе `_next_internal_code(db)`
- Если в строке есть `AvitoId`:
  - создаём `ProductAvitoListingLink(organization_id, product_id, avito_ad_id)`

### 3) Фото/обработка (то, что уже внедрили)
- Внешние ссылки → скачать/обработать → в БД пишем `/pictures/...`, в XLSX пишем `BASE_URL + /pictures/...`.

## Единая логика EXPORT (БД → XLSX)
Файлы:
- sync export: `[backend/app/routers/avito_integration.py](backend/app/routers/avito_integration.py)` (`export_products_to_avito_autoload`)
- celery export: `[backend/app/tasks/avito_tasks.py](backend/app/tasks/avito_tasks.py)` (`run_avito_export_job`)
- XLSX upsert: `[backend/app/services/avito_autoload_xlsx.py](backend/app/services/avito_autoload_xlsx.py)`

### 1) Как выбираем строку в XLSX (чтобы не плодить дубли)
Обновить `upsert_products_to_avito_autoload()` так, чтобы для товара, у которого есть `avito_id` (номер объявления):
- сначала искать строку по **AvitoId (col3)**
- затем по `unique_ad_id (col1)`
- затем по OEM/прочим fallback

Причина: для файла, скачанного из Авито, col1 может быть «чужим» идентификатором, а col3 — стабильный ключ.

### 2) Перезапись unique id при экспорте
Если строка найдена по AvitoId (col3):
- **всегда перезаписываем col1 (`Уникальный идентификатор объявления`) на `product.internal_code`**
- col3 (`Номер объявления на Авито`) не трогаем (если уже заполнен)

### 3) Фото при экспорте
- Перед передачей в upsert всегда приводим `photos` к `BASE_URL + /pictures/...` (как уже сделано).

## Изменения в БД/моделях
- Новых таблиц не требуется, используем существующую `ProductAvitoListingLink`.

## Точки проверки
- **Сценарий A (наш товар → экспорт → повторный экспорт)**:
  - первый экспорт создаёт строку
  - повторный экспорт обновляет ту же строку (не добавляет новую)
- **Сценарий B (файл скачан из Авито → импорт)**:
  - создаётся товар + link по AvitoId
- **Сценарий C (после B делаем экспорт этого товара)**:
  - строка в XLSX находится по AvitoId (col3)
  - col1 становится internal_code
  - дальше повторный экспорт обновляет строку стабильно

