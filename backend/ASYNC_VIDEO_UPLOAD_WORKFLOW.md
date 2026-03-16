# 🎯 Правильная архитектура загрузки медиа

## ✅ Как должно работать

### 1️⃣ **Быстрая загрузка (Синхронно)**

```
Пользователь → POST /upload/video → Backend
                                      ↓
                              1. Сохранить в /temp/
                              2. Запустить Celery задачу
                              3. Вернуть task_id + temp_path
                                      ↓
Пользователь ← {task_id, temp_path} ← (мгновенно!)
```

**Время ответа:** 1-2 секунды (только запись файла)

---

### 2️⃣ **Асинхронная обработка (Celery в фоне)**

```
Celery Worker (фоновый процесс)
    ↓
1. Получить задачу из очереди
2. Сжать видео (FFmpeg)
3. Применить водяной знак
4. Переместить в /videos/{org_id}/
5. Обновить базу данных
6. Удалить временный файл
```

**Время обработки:** 5-30 секунд (не блокирует пользователя)

---

### 3️⃣ **Мгновенное превью для пользователя**

```javascript
// Фронтенд получает сразу после загрузки:
{
  "task_id": "abc123",
  "temp_path": "/temp/org123/video.mp4",
  "status": "processing"
}

// Показывает видео пользователю из temp:
<video src="/api/media/temp/org123/video.mp4" />

// Опционально: polling за статусом
GET /upload/video-status/abc123
→ {"status": "completed", "path": "/videos/org123/final.mp4"}
```

---

## 🔄 Полный workflow

### Этап 1: Загрузка (1-2 сек)

```python
# POST /upload/video
@router.post("/video")
async def upload_video(file: UploadFile):
    # 1. Быстрая запись во временную папку
    temp_path = save_to_temp(file)
    
    # 2. Запуск Celery задачи В ФОНЕ
    task = process_and_upload_video.delay(temp_path, ...)
    
    # 3. Мгновенный ответ
    return {
        "task_id": task.id,
        "temp_path": f"/temp/{org_id}/{filename}",
        "status": "processing"
    }
```

### Этап 2: Обработка в Celery (5-30 сек)

```python
# app/tasks/video_tasks.py
@celery_app.task
def process_and_upload_video(temp_path, filename, org_id, ...):
    # 1. Проверка длительности
    duration = get_video_duration(temp_path)
    
    # 2. Сжатие (самая долгая операция)
    compressed_path = compress_video(
        temp_path,
        preset="ultrafast",
        crf=28
    )
    
    # 3. Водяной знак (если нужен)
    if watermark:
        final_path = add_watermark(compressed_path, logo)
    else:
        final_path = compressed_path
    
    # 4. Перемещение в финальную папку
    shutil.move(final_path, f"uploads/videos/{org_id}/{filename}")
    
    # 5. Обновление базы данных
    db.query(ProductVideo).filter(...).update({
        "path": f"/videos/{org_id}/{filename}"
    })
    
    # 6. Удаление временного файла
    os.remove(temp_path)
    
    return {"status": "completed", "path": final_path}
```

### Этап 3: Мониторинг статуса (опционально)

```python
# GET /upload/video-status/{task_id}
@router.get("/video-status/{task_id}")
async def get_video_status(task_id: str):
    task_result = AsyncResult(task_id)
    
    if task_result.state == 'SUCCESS':
        return {
            "status": "completed",
            "path": task_result.result["path"],
            "url": f"{BASE_URL}{task_result.result['path']}"
        }
    elif task_result.state == 'FAILED':
        return {
            "status": "failed",
            "error": str(task_result.result)
        }
    else:
        return {
            "status": "processing",
            "state": task_result.state
        }
```

---

## 💡 Преимущества такого подхода

### ✅ Для пользователя:

1. **Мгновенная загрузка** - не нужно ждать обработку
2. **Сразу видит превью** - видео доступно сразу из temp
3. **Может уйти со страницы** - обработка продолжится в фоне
4. **Нет таймаутов** - HTTP запрос завершается быстро

### ✅ Для сервера:

1. **Быстрые HTTP запросы** - нет долгих операций в endpoint
2. **Масштабируемость** - можно добавить больше Celery workers
3. **Надежность** - при падении задача перезапустится
4. **Контроль нагрузки** - очередь задач сглаживает пики

---

## 📊 Сравнение подходов

### ❌ НЕПРАВИЛЬНО (синхронная обработка):

```
Пользователь → Загрузка (2 сек) → Сжатие (30 сек) → Водяной знак (10 сек) → Ответ
Общее время: 42 секунды (пользователь ЖДЕТ!)
```

### ✅ ПРАВИЛЬНО (асинхронная обработка):

```
Пользователь → Загрузка (2 сек) → Ответ с task_id
                         ↓
                    Celery: Сжатие (30 сек) + Водяной знак (10 сек)
Общее время для пользователя: 2 секунды!
```

---

## 🔧 Реализация

### Обновленный `upload_video` endpoint:

```python
@router.post("/video")
async def upload_video(file: UploadFile, ...):
    # 1. Сохраняем во временную папку (БЫСТРО)
    temp_path = save_temp(file)
    
    # 2. Запускаем Celery задачу (НЕ БЛОКИРУЯ)
    task = process_and_upload_video.delay(
        temp_path,
        file.filename,
        organization_id,
        add_watermark_flag,
        logo_file_path
    )
    
    # 3. Возвращаем результат (МГНОВЕННО)
    return {
        "task_id": task.id,
        "temp_path": f"/temp/{org_id}/{filename}",
        "path": f"/temp/{org_id}/{filename}",  # Для совместимости
        "status": "processing",
        "is_temp": True
    }
```

### Celery задача `video_tasks.py`:

```python
@celery_app.task(bind=True, max_retries=3)
def process_and_upload_video(self, temp_path, filename, org_id, add_watermark, logo_path):
    try:
        # Проверка длительности
        duration = get_video_duration(temp_path)
        if duration > 30:
            raise ValueError("Видео слишком длинное")
        
        # Сжатие (долго, но в фоне)
        compressed = compress_video(
            temp_path,
            preset="ultrafast",  # Максимальная скорость
            crf=28,
            threads=1  # Аппаратное ускорение на Linux
        )
        
        # Водяной знак (опционально)
        if add_watermark and logo_path:
            final = add_watermark_to_video(compressed, logo_path)
        else:
            final = compressed
        
        # Перемещение в финальную папку
        final_filename = f"{org_id}_{timestamp}_{safe_filename}.mp4"
        final_path = f"uploads/videos/{org_id}/{final_filename}"
        shutil.move(final, final_path)
        
        # Обновление базы данных
        update_database_with_final_path(...)
        
        # Удаление временного файла
        os.remove(temp_path)
        
        return {
            "status": "completed",
            "path": f"/videos/{org_id}/{final_filename}",
            "duration": duration
        }
        
    except Exception as e:
        # Retry logic
        raise self.retry(exc=e, countdown=60)
```

---

## 🎯 Frontend интеграция

### React/Vue компонент:

```javascript
const [video, setVideo] = useState(null);
const [status, setStatus] = useState('uploading');

// 1. Загрузка файла
const handleUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Быстрый ответ (1-2 сек)
  const response = await fetch('/api/upload/video', {
    method: 'POST',
    body: formData
  });
  
  const result = await response.json();
  
  // Сразу показываем видео из temp
  setVideo({
    temp_path: result.temp_path,
    task_id: result.task_id,
    status: 'processing'
  });
  
  // 2. Polling за статусом (опционально)
  pollStatus(result.task_id);
};

// 3. Проверка статуса обработки
const pollStatus = async (taskId) => {
  while (true) {
    await sleep(2000); // Ждем 2 секунды
    
    const statusResponse = await fetch(`/api/upload/video-status/${taskId}`);
    const status = await statusResponse.json();
    
    if (status.status === 'completed') {
      setVideo(prev => ({
        ...prev,
        path: status.path,
        status: 'completed'
      }));
      break;
    }
  }
};

// 4. Отображение
return (
  <div>
    {video && (
      <video 
        src={`/api/media${video.temp_path}`} 
        controls
        // После завершения можно переключить на final path
      />
    )}
    {status === 'processing' && <div>Обработка...</div>}
  </div>
);
```

---

## 📈 Производительность

### Сценарий: 10 пользователей загружают видео одновременно

#### Без Celery (синхронно):
```
Пользователь 1: 42 сек ожидания
Пользователь 2: 42 сек ожидания
...
Пользователь 10: 42 сек ожидания
Итого: 420 сек (7 минут) суммарного времени ожидания
```

#### С Celery (асинхронно):
```
Все пользователи: 2 сек на загрузку
Обработка в фоне: параллельно (8 процессов)
Итого: 2 сек ожидания на пользователя
```

**Ускорение UX: в 21 раз!** ⚡

---

## ✅ Чек-лист правильной реализации

- [ ] Endpoint возвращает `task_id` и `temp_path`
- [ ] Celery задача запускается через `.delay()`
- [ ] Задача обрабатывается в фоне (не блокирует HTTP)
- [ ] Temp файл доступен сразу для просмотра
- [ ] Есть polling или WebSocket для обновления статуса
- [ ] После обработки обновляется база данных
- [ ] Временный файл удаляется после успешной обработки
- [ ] При ошибке задача перезапускается (retry)

---

## 🎉 Итог

**Ваша задумка ПРАВИЛЬНАЯ!** 🎯

Нужно:
1. ✅ Быстро сохранять в temp
2. ✅ Запускать Celery immediately через `.delay()`
3. ✅ Возвращать task_id фронтенду
4. ✅ Обрабатывать в фоне без блокировки

Теперь пользователи не будут ждать обработку! 🚀
