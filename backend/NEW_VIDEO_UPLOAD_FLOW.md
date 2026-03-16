# Новая схема загрузки и обработки видео

## 📋 Изменения

### БЫЛО (неправильно):
1. Загрузка видео → **СРАЗУ запуск обработки** ❌
2. Обработка в фоне (20-30 секунд)
3. Пользователь создает запчасть → ждет пока обработается ⏳
4. Только после этого может продолжить

### СТАЛО (правильно):
1. Загрузка видео → **Сохранение в temp** ✅
2. Видео доступно для просмотра из temp 🎬
3. Пользователь создает/обновляет запчасть → **мгновенно** ⚡
4. **После сохранения** → видео **попадает в очередь Celery** 🔄
5. **Celery worker берет задачу из очереди** → начинается обработка 🎯
6. Обработка завершена → авто-обновление пути в БД ✅
7. Temp файл удаляется 🗑️

**Важно:** Обработка НЕ начинается сразу! Задача ждет в очереди Celery пока worker не освободится.

---

## 🔄 Новый поток работы

### Этап 1: Загрузка видео (фронтенд)

```javascript
// 1. Пользователь выбирает видео
const file = videoInput.files[0];

// 2. Загружаем на сервер
const formData = new FormData();
formData.append('file', file);
formData.append('organization_id', orgId);

const response = await fetch('/api/upload/video', {
  method: 'POST',
  body: formData
});

const result = await response.json();
// Результат:
{
  "temp_path": "/temp/org123/abc123.mp4",
  "temp_filename": "abc123.mp4",
  "organization_id": "org123",
  "message": "Video uploaded to temp folder..."
}

// 3. Сохраняем temp_path в состоянии формы
formState.videoUrl = result.temp_path;

// 4. Показываем превью видео сразу
videoPreview.src = `${BACKEND_URL}/media${result.temp_path}`;
```

**Важно:** В этот момент Celery task НЕ запускается!

---

### Этап 2: Создание запчасти (фронтенд)

```javascript
// 1. Пользователь заполняет форму
const productData = {
  name: "Запчасть",
  price: 1000,
  videos: [formState.videoUrl]  // Используем temp_path
};

// 2. Отправляем на сервер
const response = await fetch('/api/products/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(productData)
});

const product = await response.json();
// Продукт создан! Video запись имеет:
// - video_url: "/temp/org123/abc123.mp4"
// - processing_status: "pending"

// 3. Запускаем обработку видео
// Backend автоматически отправит POST на /api/upload/start-video-processing/{video_id}
// ИЛИ фронтенд может сделать это сам при необходимости
```

---

### Этап 3: Обработка в фоне (backend)

**Backend (products.py):**
```python
# При создании продукта:
video = ProductVideo(
    product_id=db_product.id,
    video_url=url,  # Это /temp/org123/abc123.mp4
    organization_id=current_user.organization_id,
    processing_status='pending'  # ← Важно!
)

# После commit - запускаем обработку
requests.post(
    f"{base_url}/api/upload/start-video-processing/{video_id}",
    timeout=5
)
```

**Backend (upload.py - start_video_processing):**
```python
# 1. Получаем video record из БД
video_record = db.query(ProductVideo).get(product_video_id)

# 2. Извлекаем путь к temp файлу
temp_video_path = video_record.video_url  # /temp/org123/abc123.mp4

# 3. Запускаем Celery task
task = process_and_upload_video.delay(
    temp_file_path,
    final_filename,
    organization_id,
    add_watermark_flag,
    logo_file_path
)

# 4. Обновляем статус
video_record.processing_status = 'processing'
db.commit()
```

---

### Этап 4: Мониторинг обработки (фронтенд опционально)

```javascript
// Опционально: можно показать прогресс
const pollProcessing = async (taskId, productVideoId) => {
  const response = await fetch(
    `/api/upload/video-status/${taskId}?product_video_id=${productVideoId}`
  );
  
  const status = await response.json();
  
  if (status.status === 'success' && status.processing_complete) {
    console.log('✅ Видео обработано!');
    console.log('Final path:', status.final_path);
    console.log('Database updated:', status.database_updated);
    
    // Обновляем видео в UI на финальную версию
    videoPreview.src = `${BACKEND_URL}/media${status.final_path}`;
  }
};

// Запускаем поллинг если нужно
setInterval(() => pollProcessing(taskId, videoId), 2000);
```

---

## 📊 API Endpoints

### 1. Загрузка видео (темп)
```http
POST /api/upload/video
Content-Type: multipart/form-data

Response:
{
  "temp_path": "/temp/org123/abc123.mp4",
  "temp_filename": "abc123.mp4",
  "organization_id": "org123",
  "message": "Video uploaded to temp folder. Processing will start when product is created/updated."
}
```

**Важно:** `task_id` больше не возвращается! Обработка начнется позже.

---

### 2. Старт обработки
```http
POST /api/upload/start-video-processing/{product_video_id}
Authorization: Bearer TOKEN

Response:
{
  "success": true,
  "task_id": "celery-task-id-123",
  "product_video_id": 456,
  "status": "processing",
  "message": "Video processing started..."
}
```

Вызывается:
- Автоматически backend при создании/обновлении продукта
- ИЛИ фронтендом вручную при необходимости

---

### 3. Проверка статуса
```http
GET /api/upload/video-status/{task_id}?product_video_id={video_id}
Authorization: Bearer TOKEN

Response (во время обработки):
{
  "task_id": "celery-task-id-123",
  "state": "STARTED",
  "status": "processing",
  "temp_path": "/temp/org123/abc123.mp4",
  "database_updated": false
}

Response (после обработки):
{
  "task_id": "celery-task-id-123",
  "state": "SUCCESS",
  "status": "success",
  "temp_path": "/temp/org123/abc123.mp4",
  "final_path": "/videos/org123/final.mp4",
  "url": "https://server/media/videos/org123/final.mp4",
  "processing_complete": true,
  "database_updated": true  // ← БД обновлена автоматически!
}
```

---

## 🗂️ Жизненный цикл файла

```
Загрузка (0 сек)
  ↓
uploads/temp/org123/abc123.mp4
  ↓ (доступно для просмотра)
  ↓
Создание продукта (5 сек)
  ↓
ProductVideo: {
  video_url: "/temp/org123/abc123.mp4",
  processing_status: "pending"
}
  ↓
Старт обработки (6 сек)
  ↓
ProductVideo.processing_status = "processing"
Celery task запущен
  ↓
Обработка (20-30 сек)
  ↓
uploads/videos/org123/final.mp4 создано
  ↓
Авто-обновление БД (36 сек)
  ↓
ProductVideo: {
  video_url: "/videos/org123/final.mp4",  // ← Обновлен!
  processing_status: "completed"
}
  ↓
Удаление temp файла (опционально)
```

---

## 🎯 Преимущества новой схемы

### ✅ Для пользователя:
1. **Мгновенная загрузка** - видео доступно сразу
2. **Быстрое создание** - не ждет обработки (20-30 сек)
3. **Можно смотреть** превью пока обрабатывается
4. **Фон процесс** - работает пока пользователь занимается другим

### ✅ Для системы:
1. **Разделение ответственности** - загрузка ≠ обработка
2. **Контроль времени** - обработка только когда нужно
3. **Экономия ресурсов** - не обрабатываем отмененные видео
4. **Гибкость** - можно удалить видео до начала обработки

---

## 🔧 Что изменилось в коде

### upload.py
```python
# БЫЛО:
task = process_and_upload_video.delay(...)  # Сразу запускали
return {"task_id": task.id, ...}

# СТАЛО:
return {"temp_path": temp_video_path, ...}  # Просто сохраняем
# Celery task запустится позже через /start-video-processing
```

### products.py
```python
# БЫЛО:
video = ProductVideo(..., processing_status='completed')

# СТАЛО:
video = ProductVideo(..., processing_status='pending')
# После commit:
requests.post(f"/api/upload/start-video-processing/{video_id}")
```

### Добавлено:
- `POST /api/upload/start-video-processing/{product_video_id}` - запуск обработки
- Автоматическое обновление БД в `/video-status/{task_id}`

---

## 📝 Пример использования на фронтенде

```javascript
// AddPart.jsx или EditPart.jsx

const handleVideoUpload = async (file) => {
  // 1. Загружаем видео в temp
  const formData = new FormData();
  formData.append('file', file);
  formData.append('organization_id', organizationId);
  
  const response = await fetch('/api/upload/video', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  
  // 2. Сохраняем temp_path в форме
  setVideoUrl(data.temp_path);
  
  // 3. Показываем превью
  videoRef.current.src = `${API_URL}/media${data.temp_path}`;
};

const handleSubmit = async (productData) => {
  // 4. Создаем продукт с temp видео
  const response = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...productData,
      videos: [videoUrl]  // temp_path
    })
  });
  
  const product = await response.json();
  
  // 5. Backend автоматически запустил обработку!
  // Можно показать уведомление:
  toast.success('Запчасть создана! Видео обрабатывается...');
  
  // 6. Опционально: мониторим прогресс
  const videoId = product.videos[0].id;
  const taskId = product.videos[0].task_id;  // если вернули
  
  pollProcessingStatus(taskId, videoId);
};

const pollProcessingStatus = (taskId, videoId) => {
  const interval = setInterval(async () => {
    const response = await fetch(
      `/api/upload/video-status/${taskId}?product_video_id=${videoId}`
    );
    
    const status = await response.json();
    
    if (status.status === 'success' && status.processing_complete) {
      clearInterval(interval);
      
      // 7. Обновляем видео на финальное
      const finalVideoUrl = `${API_URL}/media${status.final_path}`;
      videoRef.current.src = finalVideoUrl;
      
      toast.success('Видео готово!');
    }
  }, 2000);
};
```

---

## ⚠️ Важные замечания

1. **Temp файлы не удаляются сразу**
   - Хранятся пока обработка не завершится
   - Нужен cron job для очистки старых файлов

2. **Если обработка не запустилась**
   - Фронтенд может вызвать `/start-video-processing/{video_id}` вручную
   - Или пользователь может нажать "Обновить" на продукте

3. **Производительность**
   - Загрузка мгновенная (<3 сек)
   - Создание продукта быстрое (<1 сек)
   - Обработка в фоне (20-30 сек) - не блокирует

4. **Ошибки обработки**
   - Если обработка упала, temp файл остается
   - Можно повторить через API или UI

---

## 🎉 Готово!

Теперь видео загружается быстро, обработка начинается только после создания/обновления запчасти, и пользователь не ждет 30 секунд! 🚀
