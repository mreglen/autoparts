# Добавление поддержки изображений и видео в чаты

## Обзор
Добавить возможность отправлять изображения и видео в сообщениях чата. Медиа будут храниться в отдельной таблице, сжиматься через Celery задачи, видео будет показывать индикатор загрузки.

## Этап 1: База данных и модели

### 1.1 Создать миграцию для таблицы chat_media
**Файл**: `backend/migrations/add_chat_media.sql`
- Таблица `chat_media` с полями:
  - `id` (SERIAL PRIMARY KEY)
  - `message_id` (INTEGER REFERENCES messages ON DELETE CASCADE)
  - `media_type` (VARCHAR - 'image' или 'video')
  - `file_path` (VARCHAR - путь к файлу)
  - `thumbnail_path` (VARCHAR - для видео и превью изображений)
  - `original_filename` (VARCHAR)
  - `file_size` (INTEGER - размер в байтах)
  - `mime_type` (VARCHAR)
  - `width` (INTEGER, nullable)
  - `height` (INTEGER, nullable)
  - `duration` (FLOAT, nullable - для видео)
  - `is_processing` (BOOLEAN DEFAULT TRUE - флаг обработки)
  - `created_at` (TIMESTAMP)
- Индексы для быстрого поиска

### 1.2 Обновить модель Chat Media
**Файл**: `backend/app/models/chat.py`
- Добавить класс `ChatMedia` с ORM маппингом
- Добавить relationship в `Message` для связи с медиа

### 1.3 Обновить схему Message
**Файл**: `backend/app/schemas/chat.py`
- Создать `ChatMediaResponse` схему
- Обновить `MessageResponse` для включения списка медиа
- Создать `MessageCreateWithMedia` для поддержки медиа при отправке

## Этап 2: Backend - Загрузка и обработка медиа

### 2.1 Создать Celery задачу для сжатия медиа
**Файл**: `backend/app/tasks/chat_media_tasks.py`
- Задача `compress_chat_image`:
  - Сжатие изображения (макс 1920px по ширине/высоте)
  - Создание thumbnail (400px)
  - Обновление статуса `is_processing = False`
- Задача `compress_chat_video`:
  - Использование существующей `compress_video` из `video_utils.py`
  - Создание thumbnail из первого кадра
  - Без водяного знака (как указано в требованиях)
  - Обновление статуса `is_processing = False`

### 2.2 Обновить router чатов для загрузки медиа
**Файл**: `backend/app/routers/chats.py`
- Добавить endpoint `POST /api/chats/{chat_id}/messages/upload-media`
  - Принимает файлы (images/video) + текст сообщения
  - Валидация:
    - Изображения: JPG, PNG, WebP, макс 10MB
    - Видео: MP4, WebM, макс 50MB, макс 60 сек
  - Сохранение во временную директорию
  - Создание записи в БД с `is_processing = True`
  - Запуск Celery задачи для сжатия
  - Возврат ID сообщения и медиа

### 2.3 Обновить существующие endpoint'ы
**Файл**: `backend/app/routers/chats.py`
- Обновить `get_chat_messages` для включения медиа в ответ
- Обновить `send_message` для поддержки медиа (опционально)

### 2.4 Добавить endpoint для скачивания медиа
**Файл**: `backend/app/routers/chats.py`
- `GET /api/chats/media/{media_id}` - получить медиа файл
- `GET /api/chats/media/{media_id}/thumbnail` - получить thumbnail

## Этап 3: Frontend - Redux и API

### 3.1 Обновить ChatSlice
**Файл**: `frontend/my-autoparts/src/redux/slices/ChatSlice.js`
- Добавить thunk `sendChatMedia`:
  - Загрузка FormData с файлами
  - Оптимистичное добавление сообщения с медиа
  - Отслеживание статуса обработки
- Добавить action `addMediaToMessage` - добавить медиа к сообщению
- Добавить action `updateMediaProcessingStatus` - обновить статус обработки

###