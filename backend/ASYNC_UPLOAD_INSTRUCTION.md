# Инструкция по загрузке медиа файлов (асинхронно)

## Проблема
Раньше сервер синхронно ждал завершения обработки медиа (фото/видео), что приводило к:
- Таймаутам при обработке видео (долгая обработка)
- Блокировке соединений uvicorn
- Отсутствию записей в БД

## Решение
Теперь загрузка работает **асинхронно** через Celery задачи с polling статуса.

---

## Как это работает

### 1. Загрузка файла (мгновенный ответ)

```javascript
// POST /api/upload/photo
// POST /api/upload/video  
// POST /api/upload/media
// POST /api/upload/organization-logo

const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/upload/photo', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

**Ответ сервера (сразу, без ожидания):**
```json
{
  "task_id": "ad1d0eed-9a17-4b48-9a52-cb0c9885e041",
  "status": "processing",
  "temp_filename": "9975c9644d4947b9bd19a8534317a98f.mp4",
  "organization_id": "qMHbBIoD51",
  "path": "/videos/qMHbBIoD51/qMHbBIoD51_20260316_082636_e0b1014e.mp4",
  "message": "Video is being processed. Poll /api/upload/photo-status/{task_id} for updates."
}
```

### 2. Проверка статуса (polling)

```javascript
async function checkUploadStatus(taskId) {
  const response = await fetch(`/api/upload/photo-status/${taskId}`);
  const status = await response.json();
  
  console.log('Status:', status);
  
  if (status.status === 'completed') {
    // ✅ УСПЕХ! Файл готов
    console.log('File URL:', status.url);
    console.log('File path:', status.path);
    console.log('Filename:', status.filename);
    
    return {
      success: true,
      url: status.url,
      path: status.path,
      filename: status.filename,
      duration: status.duration  // только для видео
    };
  } 
  else if (status.status === 'failed') {
    // ❌ ОШИБКА
    console.error('Upload failed:', status.error);
    console.error('Traceback:', status.traceback);
    
    return {
      success: false,
      error: status.error,
      traceback: status.traceback
    };
  }
  else {
    // ⏳ ЕЩЁ ОБРАБАТЫВАЕТСЯ
    console.log('Processing...', status.message);
    return null;  // Продолжаем polling
  }
}
```

### 3. Реализация polling с повторными попытками

```javascript
async function waitForUploadCompletion(taskId, maxAttempts = 60, intervalMs = 2000) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      // Ждём интервал перед проверкой
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
      // Проверяем статус
      const statusResult = await checkUploadStatus(taskId);
      
      if (statusResult !== null) {
        // Статус изменился (успех или ошибка)
        return statusResult;
      }
      
      attempts++;
      console.log(`Polling attempt ${attempts}/${maxAttempts}...`);
      
    } catch (error) {
      console.error('Error checking status:', error);
      attempts++;
    }
  }
  
  // Превышено время ожидания
  return {
    success: false,
    error: 'Timeout: File processing took too long'
  };
}
```

### 4. Полный пример использования

```javascript
async function uploadMediaFile(file) {
  try {
    // Шаг 1: Загружаем файл
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadResponse = await fetch('/api/upload/photo', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      throw new Error('Upload failed: ' + uploadResponse.statusText);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('Upload started:', uploadResult);
    
    // Шаг 2: Ждём завершения обработки
    const completionResult = await waitForUploadCompletion(uploadResult.task_id);
    
    if (completionResult.success) {
      console.log('✅ Upload complete!');
      console.log('URL:', completionResult.url);
      
      // Возвращаем результат
      return {
        success: true,
        ...completionResult
      };
    } else {
      console.error('❌ Upload failed:', completionResult.error);
      return {
        success: false,
        error: completionResult.error
      };
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Использование:
const result = await uploadMediaFile(fileInput.files[0]);
if (result.success) {
  // Используем result.url для отображения
  document.getElementById('preview').src = result.url;
} else {
  alert('Ошибка загрузки: ' + result.error);
}
```

---

## Статусы задачи

| Статус | Описание | Что делать |
|--------|----------|------------|
| `pending` | Задача ожидает обработки | Продолжать polling |
| `processing` | Задача обрабатывается | Продолжать polling |
| `completed` | Задача завершена успешно | Использовать `result.url` |
| `failed` | Ошибка обработки | Показать ошибку пользователю |
| `retrying` | Попытка повторной обработки | Продолжать polling |
| `cancelled` | Задача отменена | Начать загрузку заново |

---

## Рекомендуемые параметры polling

```javascript
const POLLING_CONFIG = {
  interval: 2000,      // 2 секунды между запросами
  maxAttempts: 60,     // Максимум 60 попыток (2 минуты)
  timeout: 120000      // Общий таймаут 120 секунд
};
```

**Для разных типов файлов:**
- **Фото**: 10-30 секунд обработки → 15-20 попыток
- **Видео**: 30-90 секунд обработки → 45-60 попыток
- **Логотипы**: 5-15 секунд обработки → 10-15 попыток

---

## Обработка ошибок

```javascript
async function robustUploadWithRetry(file, maxRetries = 3) {
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const result = await uploadMediaFile(file);
      
      if (result.success) {
        return result;
      }
      
      console.warn(`Attempt ${retry + 1} failed:`, result.error);
      
      // Ждём перед следующей попыткой
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`Attempt ${retry + 1} error:`, error);
      
      if (retry === maxRetries - 1) {
        throw error; // Последняя попытка не удалась
      }
    }
  }
  
  throw new Error('All retry attempts failed');
}
```

---

## Интеграция с Redux Toolkit (пример)

```javascript
// slices/mediaSlice.js
export const uploadPhoto = createAsyncThunk(
  'media/uploadPhoto',
  async (file, { rejectWithValue }) => {
    try {
      // Шаг 1: Загрузка
      const formData = new FormData();
      formData.append('file', file);
      
      const uploadResp = await fetch('/api/upload/photo', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResp.ok) throw new Error('Upload failed');
      
      const uploadData = await uploadResp.json();
      
      // Шаг 2: Ожидание завершения
      const maxAttempts = 60;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000));
        
        const statusResp = await fetch(`/api/upload/photo-status/${uploadData.task_id}`);
        const statusData = await statusResp.json();
        
        if (statusData.status === 'completed') {
          return {
            task_id: uploadData.task_id,
            url: statusData.url,
            path: statusData.path,
            filename: statusData.filename
          };
        }
        
        if (statusData.status === 'failed') {
          throw new Error(statusData.error);
        }
      }
      
      throw new Error('Timeout waiting for upload');
      
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

---

## Важные замечания

1. **Не блокируйте UI** - polling должен работать в фоне
2. **Показывайте прогресс** - индикатор "Обработка..." во время ожидания
3. **Обрабатывайте ошибки сети** - могут быть временные сбои
4. **Предусмотрите отмену** - кнопка "Отменить" для пользователя
5. **Очищайте ресурсы** - удаляйте неиспользуемые файлы через `/api/upload/temp/{filename}`

---

## Контакты

При возникновении проблем обращайтесь к backend разработчику с указанием:
- `task_id` из ответа сервера
- Логи Celery worker (`/var/log/autoparts/celery-worker.log`)
- Статус задачи из `/api/upload/photo-status/{task_id}`
