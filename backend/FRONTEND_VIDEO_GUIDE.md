# 🎬 Frontend Guide: Работа с временными видео

## 🔑 Ключевые изменения в API

### БЫЛО (старый ответ):
```javascript
{
  "task_id": "...",
  "status": "processing",
  "path": "/videos/org123/final.mp4",
  "filename": "final.mp4"
}
```

### СТАЛО (новый ответ):
```javascript
{
  "temp_path": "/temp/org123/abc123.mp4",  // ← Для превью
  "path": "/temp/org123/abc123.mp4",       // ← Для совместимости
  "temp_filename": "abc123.mp4",
  "filename": "abc123.mp4",                // ← Для совместимости
  "organization_id": "org123",
  "is_temp": true,                         // ← Флаг временного файла
  "message": "Video uploaded to temp folder..."
}
```

---

## 📝 Обновленный поток работы

### 1. Загрузка видео

```javascript
// EditPart.jsx или AddPart.jsx

const handleVideoUpload = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('organization_id', organizationId);
  
  try {
    const response = await fetch('/api/upload/video', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    console.log('Video upload response:', data);
    // {
    //   temp_path: "/temp/TVgpq7hgzd/5f69c23bf2c64a919fb52dc444654c05.mp4",
    //   path: "/temp/TVgpq7hgzd/5f69c23bf2c64a919fb52dc444654c05.mp4",
    //   filename: "5f69c23bf2c64a919fb52dc444654c05.mp4",
    //   is_temp: true,
    //   ...
    // }
    
    // ✅ Проверяем что есть path или temp_path
    const videoPath = data.path || data.temp_path;
    
    if (!videoPath) {
      throw new Error('Video upload response missing path or temp_path');
    }
    
    // ✅ Сохраняем в состоянии формы
    setVideoUrl(videoPath);
    setVideoFilename(data.filename || data.temp_filename);
    setVideoIsTemp(data.is_temp || false);
    
    // ✅ Показываем превью
    if (videoRef.current) {
      videoRef.current.src = `${API_URL}/media${videoPath}`;
    }
    
    toast.success('Видео загружено! Обработка начнется после создания запчасти.');
    
  } catch (error) {
    console.error('Video upload error:', error);
    toast.error('Ошибка загрузки видео: ' + error.message);
  }
};
```

---

### 2. Создание/Обновление запчасти

```javascript
const handleSubmit = async (productData) => {
  try {
    // Создаем продукт с temp видео
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...productData,
        videos: [videoUrl]  // Отправляем temp_path
      })
    });
    
    const product = await response.json();
    
    // Backend автоматически запустил обработку!
    // Video запись имеет:
    // - video_url: temp_path
    // - processing_status: 'pending' -> 'processing'
    
    toast.success('Запчасть создана! Видео обрабатывается...');
    
    // Опционально: запускаем polling для отслеживания прогресса
    if (product.videos && product.videos.length > 0) {
      const videoId = product.videos[0].id;
      pollProcessingStatus(videoId);
    }
    
  } catch (error) {
    console.error('Product creation error:', error);
    toast.error('Ошибка создания записи');
  }
};
```

---

### 3. Мониторинг обработки (опционально)

```javascript
const pollProcessingStatus = async (videoId) => {
  const maxAttempts = 90; // 3 минуты макс
  let attempt = 0;
  
  const interval = setInterval(async () => {
    attempt++;
    
    try {
      // Получаем информацию о продукте чтобы найти task_id
      // ИЛИ храним task_id после создания продукта
      const response = await fetch(`/api/upload/video-status/${taskId}?product_video_id=${videoId}`);
      const status = await response.json();
      
      console.log(`Polling attempt ${attempt}/${maxAttempts}:`, status.status);
      
      if (status.status === 'success' && status.processing_complete) {
        clearInterval(interval);
        
        // ✅ Обработка завершена!
        console.log('✅ Video processing complete!');
        console.log('Final path:', status.final_path);
        console.log('Database updated:', status.database_updated);
        
        // ✅ Обновляем видео на финальную версию
        if (status.final_path) {
          setVideoUrl(status.final_path);
          setVideoIsTemp(false);
          
          if (videoRef.current) {
            videoRef.current.src = `${API_URL}/media${status.final_path}`;
          }
          
          toast.success('Видео готово и оптимизировано!');
        }
        
      } else if (status.status === 'failed') {
        clearInterval(interval);
        console.error('❌ Video processing failed:', status.error);
        toast.error('Ошибка обработки видео: ' + status.error);
      }
      
      // Если еще processing - продолжаем polling
      if (attempt >= maxAttempts) {
        clearInterval(interval);
        console.warn('⚠️ Timeout: Video processing took too long');
        toast.warning('Обработка видео заняла слишком много времени');
      }
      
    } catch (error) {
      console.error('Polling error:', error);
      // Не прерываем polling при ошибке сети
    }
    
  }, 2000); // Проверка каждые 2 секунды
};
```

---

## 🎯 Обработка ответа от сервера

### Пример ответа при загрузке:

```javascript
{
  "temp_path": "/temp/TVgpq7hgzd/5f69c23bf2c64a919fb52dc444654c05.mp4",
  "path": "/temp/TVgpq7hgzd/5f69c23bf2c64a919fb52dc444654c05.mp4",
  "temp_filename": "5f69c23bf2c64a919fb52dc444654c05.mp4",
  "filename": "5f69c23bf2c64a919fb52dc444654c05.mp4",
  "organization_id": "TVgpq7hgzd",
  "is_temp": true,
  "message": "Video uploaded to temp folder. Processing will start when product is created/updated."
}
```

### Что использовать:

```javascript
// ✅ Для отображения (превью):
const previewUrl = `${API_URL}/media${data.path}`;

// ✅ Для сохранения в форме:
formState.videoUrl = data.path;

// ✅ Для проверки типа:
if (data.is_temp) {
  console.log('Это временное видео, обработка начнется позже');
}

// ✅ Для имени файла:
const displayName = data.filename || data.temp_filename;
```

---

## ⚠️ Важные моменты

### 1. Всегда проверяй наличие `path`

```javascript
// ❌ НЕПРАВИЛЬНО:
if (!data.temp_path) {
  throw new Error('Missing path');
}

// ✅ ПРАВИЛЬНО:
const videoPath = data.path || data.temp_path;
if (!videoPath) {
  throw new Error('Video upload response missing path or temp_path');
}
```

### 2. Используй `is_temp` флаг

```javascript
if (data.is_temp) {
  // Показать уведомление что обработка будет позже
  toast.info('Видео будет обработано после создания запчасти');
} else {
  // Видео уже готово
  toast.success('Видео готово к использованию');
}
```

### 3. Конструиируй правильный URL

```javascript
// Для temp видео:
const tempVideoUrl = `${API_URL}/media${data.path}`;
// Результат: http://server/media/temp/org123/file.mp4

// Для final видео:
const finalVideoUrl = `${API_URL}/media${data.final_path}`;
// Результат: http://server/media/videos/org123/file.mp4
```

---

## 🔄 Полный пример компонента

```javascript
import React, { useRef, useState } from 'react';

const VideoUploader = ({ organizationId, onVideoUploaded }) => {
  const videoRef = useRef(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoFilename, setVideoFilename] = useState('');
  const [videoIsTemp, setVideoIsTemp] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('organization_id', organizationId);
      
      const response = await fetch('/api/upload/video', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      console.log('Video upload response:', data);
      
      // ✅ Извлекаем путь (с поддержкой обоих форматов)
      const videoPath = data.path || data.temp_path;
      
      if (!videoPath) {
        throw new Error('Video upload response missing path or filename');
      }
      
      // ✅ Сохраняем данные
      setVideoUrl(videoPath);
      setVideoFilename(data.filename || data.temp_filename);
      setVideoIsTemp(data.is_temp || false);
      
      // ✅ Показываем превью
      if (videoRef.current) {
        videoRef.current.src = `${process.env.REACT_APP_API_URL}/media${videoPath}`;
      }
      
      // ✅ Уведомляем родителя
      if (onVideoUploaded) {
        onVideoUploaded({
          url: videoPath,
          filename: data.filename || data.temp_filename,
          isTemp: data.is_temp || false
        });
      }
      
      toast.success('Видео загружено!');
      
    } catch (error) {
      console.error('Video upload error:', error);
      toast.error('Ошибка: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleCreateProduct = async (productData) => {
    // Создаем продукт
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...productData,
        videos: videoUrl ? [videoUrl] : []
      })
    });
    
    const product = await response.json();
    
    //Backend запустил обработку видео
    toast.success('Запчасть создана! Видео обрабатывается...');
    
    // Начинаем мониторинг если нужно
    if (product.videos?.[0]?.id) {
      startMonitoring(product.videos[0].id);
    }
  };
  
  const startMonitoring = (videoId) => {
    const taskId = /* где-то сохраненный task_id */;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/upload/video-status/${taskId}?product_video_id=${videoId}`
        );
        const status = await response.json();
        
        setProcessingStatus(status.status);
        
        if (status.status === 'success' && status.processing_complete) {
          clearInterval(pollInterval);
          
          // Обновляем на финальное видео
          if (status.final_path) {
            setVideoUrl(status.final_path);
            setVideoIsTemp(false);
            
            if (videoRef.current) {
              videoRef.current.src = `${process.env.REACT_APP_API_URL}/media${status.final_path}`;
            }
            
            toast.success('Видео готово!');
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);
  };
  
  return (
    <div>
      <input 
        type="file" 
        accept="video/*"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      
      {(videoUrl || videoIsTemp) && (
        <div>
          <video ref={videoRef} controls width="400">
            <source src={`${process.env.REACT_APP_API_URL}/media${videoUrl}`} />
            Your browser does not support the video tag.
          </video>
          
          {videoIsTemp && (
            <div className="bg-yellow-100 p-2 mt-2 rounded">
              <p className="text-sm text-yellow-800">
                ⏳ Видео во временном хранилище. Обработка начнется после создания запчасти.
              </p>
            </div>
          )}
          
          {processingStatus === 'processing' && (
            <div className="bg-blue-100 p-2 mt-2 rounded">
              <p className="text-sm text-blue-800">
                🔄 Видео обрабатывается...
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoUploader;
```

---

## 🎨 UI подсказки

### Показывай статус видео:

```jsx
{videoIsTemp && (
  <div className="alert alert-warning">
    ⏳ Видео будет обработано после создания запчасти
  </div>
)}

{processingStatus === 'processing' && (
  <div className="alert alert-info">
    🔄 Обработка видео...
  </div>
)}

{processingStatus === 'completed' && (
  <div className="alert alert-success">
    ✅ Видео оптимизировано и готово
  </div>
)}
```

---

## ✅ Чеклист для фронтенда

- [x] Проверять наличие `path` или `temp_path` в ответе
- [x] Использовать `path` для превью и сохранения в форме
- [x] Проверять `is_temp` флаг для показа статуса
- [x] Показывать пользователю что обработка будет позже
- [x] Опционально: polling для отслеживания прогресса
- [x] Обновлять видео на финальное когда `processing_complete=true`

---

## 🎉 Готово!

Теперь фронтенд корректно обработает новый формат ответа и будет работать с временными видео! 🚀
