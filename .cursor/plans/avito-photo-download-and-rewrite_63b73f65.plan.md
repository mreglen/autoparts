---
name: avito-photo-download-and-rewrite
overview: При импорте/экспорте Avito XLSX скачивать внешние фото, обрабатывать (watermark+сжатие) существующей Celery-задачей, и синхронно подменять ссылки в XLSX на локальные `BASE_URL + /pictures/{org_id}/...`.
todos:
  - id: media-service
    content: "Сделать сервис: скачать внешние URL в temp, определить watermark settings, синхронно прогнать process_and_upload_photo и вернуть локальные URL/paths"
    status: completed
  - id: import-rewrite-photos
    content: "В import_avito_autoload_rows: перед созданием ProductPhoto обеспечить локальные фото; обновить XLSX ячейку Ссылки на фото и кэш"
    status: completed
  - id: export-rewrite-photos
    content: "В export (sync + celery): перед upsert_products_to_avito_autoload подменять photos на локальные BASE_URL+path, при необходимости скачивая/обрабатывая"
    status: completed
  - id: timeouts-errors
    content: Добавить таймауты, лимиты, и мягкую деградацию (если фото не обработалось — не падаем целиком)
    status: completed
isProject: false
---

## Цель
- Для строк Avito autoload XLSX обеспечить, что фото в итоге становятся **локальными**:
  - если ссылка не локальная (не начинается с `/pictures/`, `/uploads/`, `/temp/`) — **скачать**
  - затем **сжать + webp + watermark** (по настройкам организации)
  - сохранить в `/pictures/{org_id}/...`
  - подменить ссылки в XLSX на **`BASE_URL.rstrip('/') + final_path`**
- Подмена выполняется **синхронно** (импорт/экспорт ждёт результата).

## Что уже есть (переиспользуем)
- **Пайплайн обработки фото**: `process_and_upload_photo` в `[backend/app/tasks/photo_tasks.py](backend/app/tasks/photo_tasks.py)`:
  - watermark + сжатие + webp
  - сохранение в `uploads/pictures/{org_id}/...` и возврат `path` вида `/pictures/{org_id}/...webp`
- **Логика watermark/лого**: в `[backend/app/routers/upload.py](backend/app/routers/upload.py)` (organization.watermark 0/1/2 + logo path).
- **Парсер/экспортер XLSX**: `[backend/app/services/avito_autoload_xlsx.py](backend/app/services/avito_autoload_xlsx.py)`

## Дизайн
### 1) Общая утилита “привести фото к локальным”
Добавить сервис (например `[backend/app/services/avito_media.py](backend/app/services/avito_media.py)`):
- `is_local_media(url: str) -> bool`
  - локальное, если начинается с `/pictures/`, `/uploads/`, `/temp/`
- `download_to_temp(url, org_id) -> str`
  - скачивает по http(s) и сохраняет в `uploads/temp/{org_id}/{uuid}.{ext}`
  - возвращает temp url: `/temp/{org_id}/{uuid}.{ext}`
  - важно: таймауты, лимит размера (напр. 20–30MB), allowlist схем (только http/https)
- `get_watermark_settings(db, org_id) -> (add_watermark_flag, logo_file_path)`
  - повторить логику из `upload.py`, но вынести в общую функцию
- `process_temp_to_pictures_sync(temp_abs_path, org_id, add_watermark, logo_path) -> str`
  - вызывает Celery `process_and_upload_photo.delay(...)`
  - синхронно ждёт `AsyncResult.get(timeout=...)`
  - возвращает `final_path` (ожидаем `/pictures/{org_id}/...webp`)
- `ensure_local_pictures(urls: list[str], org_id, db) -> list[str]`
  - для каждого url:
    - если локальный — нормализовать в **полный URL** через BASE_URL (как требует XLSX)
    - если внешний — скачать → обработать → получить final_path → вернуть **полный URL**
  - дедупликация с сохранением порядка

### 2) Импорт: скачать/обработать перед созданием ProductPhoto
Точка встраивания: `import_avito_autoload_rows` в `[backend/app/routers/avito_integration.py](backend/app/routers/avito_integration.py)`.
- До блока, где создаются `ProductPhoto` из `item["photos"]`, сделать:
  - `processed_urls = ensure_local_pictures(item["photos"], org_id, db)`
  - затем уже писать `ProductPhoto.photo_url = processed_url` (либо хранить относительный path — см. ниже)

**Решение по хранению в БД**
- В БД сейчас встречаются относительные пути (`/pictures/...`) и иногда абсолютные.
- Для предсказуемости:
  - в БД хранить **относительный путь** (`/pictures/...`) — как сейчас часто сделано
  - для XLSX писать **абсолютный** URL `BASE_URL + path`
- Поэтому `ensure_local_pictures` может возвращать два набора (paths + urls) или флаг `for_xlsx=True/False`.

### 3) Экспорт: подмена ссылок в XLSX на локальные
Точки:
- синхронный экспорт: `export_products_to_avito_autoload` в `[backend/app/routers/avito_integration.py](backend/app/routers/avito_integration.py)`
- async export (celery): `run_avito_export_job` в `[backend/app/tasks/avito_tasks.py](backend/app/tasks/avito_tasks.py)`

Изменения:
- когда формируем `export_rows`, вместо `photos` как есть:
  - `photos = ensure_local_pictures(existing_photo_urls, org_id, db, for_xlsx=True)`
- так `upsert_products_to_avito_autoload` получит уже готовые URL и запишет их в колонку `Ссылки на фото`.

### 4) Подмена фото непосредственно в XLSX (для уже загруженного файла)
Дополнительно (по вашему запросу): если пользователь выбрал импорт/экспорт — не только БД, но и **XLSX** должен обновиться.
- Для импорта:
  - после обработки `processed_urls_for_xlsx` обновить ячейку `Ссылки на фото` в этой строке
  - затем сохранить XLSX и перепарсить (как мы делали для категории)
- Реализовать как отдельную функцию:
  - `rewrite_xlsx_photos(xlsx_path, sheet, row, urls_for_xlsx)`

## Ошибки и ограничения
- **Если фото не скачалось/не обработалось**:
  - либо оставить оригинальную ссылку (мягкий режим)
  - либо добавить запись в `local_errors`/notice и продолжить
- **Таймауты**:
  - общий лимит на строку (напр. 60–120 секунд)
  - лимит на одно фото (напр. 15–30 секунд)
- **Лимит количества**:
  - Avito обычно ограничивает 5 фото — используем первые 5

## Тест-план (ручной)
- Импорт: загрузить XLSX с внешними ссылками на фото → выбрать строки → импорт:
  - фото сохраняются в `backend/uploads/pictures/{org_id}/...webp`
  - в XLSX строке ссылки заменены на `BASE_URL + /pictures/...`
  - в БД у товара фото стали локальными
- Экспорт: выбрать товары → экспорт:
  - в файле `autoload.xlsx` `Ссылки на фото` содержат только `BASE_URL + /pictures/...`

