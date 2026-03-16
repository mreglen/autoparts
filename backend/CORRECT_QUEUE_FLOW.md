# 🎯 Правильная схема работы с очередью Celery

## 🔑 Ключевое понимание

### Celery работает так:

```
task.delay()  →  Задача попадает в QUEUE  →  Worker берет из QUEUE  →  Выполнение
                 (мгновенно)                (когда освободится)       (20-30 сек)
```

**ВАЖНО:** `task.delay()` НЕ начинает выполнение сразу!  
Он только **добавляет задачу в очередь** Redis/RabbitMQ.

---

## 📊 Полный поток с очередью

### Этап 1: Загрузка видео (фронтенд)
```
POST /api/upload/video
  ↓
Сохранение в uploads/temp/org_id/file.mp4
  ↓
Возврат temp_path фронтенду
  ↓
✅ Видео доступно для просмотра (из temp)
```

**Celery:** ❌ Не задействован  
**Время:** 1-3 секунды

---

### Этап 2: Создание запчасти (фронтенд)
```
POST /api/products
  ↓
Создание ProductVideo в БД
  - video_url: "/temp/org_id/file.mp4"
  - processing_status: "pending"
  ↓
POST /api/upload/start-video-processing/{video_id}
  ↓
✅ Запись в БД обновлена: status = "processing"
```

**Celery:** ❌ Еще не запущен  
**Время:** <1 секунды

---

### Этап 3: Отправка в очередь Celery
```python
# upload.py: start_video_processing()

# Создаем задачу Celery
task = process_and_upload_video.delay(
    temp_file_path,
    final_filename,
    organization_id,
    ...
)
```

**Что происходит:**
1. Сериализация параметров задачи
2. **Отправка в Redis/RabbitMQ** (брокер сообщений)
3. Задача ждет в очереди `celery`
4. Возврат `task.id`

**Celery:** ✅ Задача в очереди  
**Время:** <100ms  
**Обработка:** ❌ Еще НЕ началась!

---

### Этап 4: Ожидание в очереди

```
Redis Queue "celery":
┌─────────────────────────────────────┐
│ Task 1: video_123 (waiting)         │ ← Ждет worker
│ Task 2: video_456 (waiting)         │
│ Task 3: video_789 (running)         │ ← Сейчас обрабатывается
│ Task 4: video_101 (waiting)         │
└─────────────────────────────────────┘
```

**Celery Workers:**
- Worker 1: Обрабатывает Task 3
- Worker 2: Свободен → возьмет Task 1
- Worker 3: Свободен → возьмет Task 2

**Когда начнется обработка?**
- Зависит от количества workers
- Зависит от длины очереди
- Обычно: сразу если есть свободный worker

---

### Этап 5: Worker берет задачу

```
Celery Worker:
1. Polling Redis: "Есть новые задачи?"
2. Redis: "Да, task_id=abc123"
3. Worker забирает задачу
4. Worker выполняет: process_and_upload_video(...)
```

**Выполнение:**
```
[2026-03-16 22:36:09] Received task: app.tasks.video_tasks.process_and_upload_video
[2026-03-16 22:36:09] Running: CPU cores: 2, Using threads: 1
[2026-03-16 22:36:09] Running FFmpeg command...
[2026-03-16 22:36:29] ✓ Video compressed successfully
[2026-03-16 22:36:29] Task succeeded: {'path': '/videos/...', 'status': 'success'}
```

**Celery:** ✅ Обработка идет  
**Время:** 20-30 секунд

---

### Этап 6: Обновление БД

```python
# Фронтенд polling:
GET /api/upload/video-status/{task_id}?product_video_id={video_id}

# Backend проверяет:
task_result = AsyncResult(task_id)

if task_result.state == 'SUCCESS':
    result = task_result.result
    
    # Авто-обновление БД:
    video_record.video_url = result['path']  # Меняем с temp на final
    video_record.processing_status = 'completed'
    db.commit()
    
    return {"database_updated": True}
```

**Результат:**
- ✅ БД обновлена
- ✅ Путь изменен с `/temp/...` на `/videos/...`
- ✅ Temp файл можно удалить

---

## 🔄 Визуальная схема

```
┌──────────────┐
│   Фронтенд   │
│              │
│ 1. Upload    │──────────┐
│    video     │          │
│              │          ▼
│ 2. Create    │     ┌──────────┐
│    product   │────▶│  Backend │
│              │     └──────────┘
│              │          │
│ 5. Poll      │          │ 3. task.delay()
│    status    │◀─────────┤    (в очередь)
│              │          │
│ 7. Show      │          ▼
│    final     │     ┌──────────┐
└──────────────┘     │   Redis  │
                     │  Queue   │
                     └──────────┘
                          │
                          │ 4. Worker берет
                          ▼
                     ┌──────────┐
                     │  Celery  │
                     │  Worker  │
                     └──────────┘
                          │
                          │ 6. Обработка
                          ▼
                     ┌──────────┐
                     │  FFmpeg  │
                     │ Compress │
                     └──────────┘
```

---

## ⏱️ Тайминги

| Этап | Действие | Время | Где |
|------|----------|-------|-----|
| 1 | Загрузка в temp | 1-3 сек | Backend → Disk |
| 2 | Создание продукта | <1 сек | Backend → DB |
| 3 | Отправка в очередь | <100ms | Backend → Redis |
| 4 | Ожидание в очереди | 0-30 сек | Redis Queue |
| 5 | Обработка | 20-30 сек | Celery Worker |
| 6 | Обновление БД | <1 сек | Worker → DB |

**Итого:** 22-36 секунд от загрузки до готовности

---

## 🎯 Почему это правильно?

### ✅ Преимущества очереди:

1. **Не блокирует backend**
   - Request/Response завершаются мгновенно
   - Пользователь не ждет обработку

2. **Контроль нагрузки**
   - Workers берут задачи по мере возможностей
   - Нет перегрузки сервера

3. **Масштабируемость**
   - Можно добавить больше workers
   - Очередь сама распределяет нагрузку

4. **Надежность**
   - Задачи не теряются при перезагрузке
   - Можно перезапустить worker без потери задач

5. **Гибкость**
   - Приоритеты задач
   - Отложенные задачи
   - Повторные попытки при ошибках

---

## 📝 Как это видит пользователь

```
[Загрузка видео]
  ↓
✅ Готово! (3 сек)
  ↓
[Создание запчасти]
  ↓
✅ Готово! (<1 сек)
  ↓
[Фон: Обработка видео]
  ├─ 0-5 сек: "В очереди..."
  ├─ 5-10 сек: "Ожидание worker..."
  ├─ 10-30 сек: "Обработка 45%..."
  └─ 30-35 сек: "✅ Готово!"
```

**Пользователь:**
- ✅ Мгновенно получает результат
- ✅ Может продолжить работу
- ✅ Видит прогресс в фоне
- ✅ Получает уведомление о готовности

---

## 🔍 Мониторинг очереди

### Проверка очереди Redis:

```bash
redis-cli
> LLEN celery
(integer) 3  # Количество задач в очереди
```

### Проверка workers:

```bash
celery -A app.celery_app inspect active
# Покажет активные задачи на каждом worker

celery -A app.celery_app inspect registered
# Покажет зарегистрированные tasks
```

### Логи Celery:

```bash
sudo journalctl -u celery.service -f

# Должно быть видно:
# [INFO] Received task: app.tasks.video_tasks.process_and_upload_video[uuid]
# [WARNING] CPU cores: 2, Using threads: 1
# [WARNING] ⚡ Compressing video...
# [WARNING] ✓ Video compressed successfully
# [INFO] Task succeeded: {path: ..., status: success}
```

---

## 🚨 Проблемы и решения

### Проблема: Задачи не выполняются

**Симптомы:**
- Загрузка прошла успешно
- Продукт создан
- Но обработка не начинается

**Проверка:**
```bash
# 1. Проверка очереди
redis-cli LLEN celery

# 2. Проверка workers
ps aux | grep celery

# 3. Проверка логов
sudo systemctl status celery
```

**Решения:**
1. Перезапустить Celery worker
2. Проверить подключение к Redis
3. Увеличить количество workers

---

### Проблема: Долгое ожидание

**Симптомы:**
- Задачи в очереди
- Но обработка не начинается > 1 минуты

**Причины:**
- Мало workers
- Все workers заняты
- Медленная обработка одной задачи

**Решение:**
```bash
# Добавить еще workers
sudo systemctl edit celery.service

# Изменить:
ExecStart=/path/to/celery -A app.celery_app worker --loglevel=info --concurrency=4
# concurrency=4 увеличит количество потоков

sudo systemctl daemon-reload
sudo systemctl restart celery
```

---

## 💡 Best Practices

### 1. Настройка concurrency

```python
# Для CPU-bound задач (как FFmpeg):
# Используем 1-2 потока на ядро CPU

# 2 ядра CPU → concurrency=2
# 4 ядра CPU → concurrency=4
# 8 ядер CPU → concurrency=6-8
```

### 2. Мониторинг длины очереди

```python
# Если очередь > 10 задач постоянно:
# - Добавить workers
# - Увеличить concurrency
# - Оптимизировать время обработки
```

### 3. Timeout задач

```python
# В celery_app.py:
task_time_limit=300  # 5 минут максимум на задачу
task_soft_time_limit=240  # Предупреждение за 1 минуту
```

### 4. Retry при ошибках

```python
@celery_app.task(bind=True, max_retries=3)
def process_and_upload_video(self, ...):
    try:
        # Обработка
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)  # Повтор через 1 мин
```

---

## 🎉 Итог

**Правильный поток:**
1. Загрузка → temp (быстро)
2. Создание продукта → БД (быстро)
3. **Отправка в очередь Celery** (мгновенно)
4. **Ожидание в очереди** (зависит от нагрузки)
5. Обработка worker (20-30 сек)
6. Обновление БД (быстро)

**Ключевое:**
- ✅ `task.delay()` = отправка в очередь, НЕ запуск
- ✅ Обработка начнется когда worker возьмет задачу
- ✅ Пользователь не ждет обработку
- ✅ Система масштабируется автоматически

**Теперь правильно!** 🎯
