# Исправление проблемы с отображением видео

## Проблема

После сохранения продукта и успешной обработки видео в Celery (сжатие + водяной знак), пользователь **продолжает видеть старую temp версию** видео вместо финальной обработанной.

### Лог Celery (успешная обработка):
```
[2026-03-17 00:31:08,956: WARNING/MainProcess] ✓ Video saved successfully!
[2026-03-17 00:31:08,956: WARNING/MainProcess] Final path: uploads/videos/TVgpq7hgzd/TVgpq7hgzd_20260317_002906_No_1_train_arriving_Penn_Station.mp4
[2026-03-17 00:31:08,960: INFO/MainProcess] Task succeeded in 122.12s
```

### Лог Frontend (проблема):
```javascript
Video loaded successfully: https://svoygarage.ru/server/uploads/temp/TVgpq7hgzd/e4a93568f275481286c011c921c837a1.mp4
// ❌ Показывается temp файл, а не финальный /videos/...
```

## Причина

Frontend после отправки PUT запроса на `/products/{id}`:
1. ✅ Успешно обновляет продукт
2. ✅ Backend запускает обработку видео
3. ❌ **Не получает обновлённые данные продукта**
4. ❌ Продолжает показывать старые `temp` пути

## Решение

Добавлено получение **свежих данных продукта** через 2 секунды после обновления:

```javascript
// EditPart.jsx - handleSubmit function
setTimeout(async () => {
  try {
    const freshProduct = await dispatch(fetchProduct(parseInt(id, 10))).unwrap();
    console.log('📥 Fresh product data received:', freshProduct);
    
    // Обновляем существующие видео с финальными путями
    if (freshProduct.videos && freshProduct.videos.length > 0) {
      setExistingVideos(freshProduct.videos);
      console.log('✅ Updated existing videos with final paths');
    }
  } catch (error) {
    console.error('⚠️ Error fetching fresh product data:', error);
  }
}, 2000);
```

## Как это работает

### До исправления:
```
User Clicks Save
    ↓
PUT /products/{id} → Success ✅
    ↓
Backend starts Celery task
    ↓
Celery processes video (122 sec)
    ↓
User sees OLD temp video ❌
```

### После исправления:
```
User Clicks Save
    ↓
PUT /products/{id} → Success ✅
    ↓
Wait 2 seconds
    ↓
GET /products/{id} → Fresh data ✅
    ↓
Update state with final video paths ✅
    ↓
User sees FINAL processed video ✅
```

## Проверка

### 1. Откройте консоль браузера (F12)

После нажатия "Сохранить" вы должны увидеть:

```javascript
✅ Product updated successfully, fetching fresh data...
📥 Fresh product data received: {
  id: 9,
  videos: [{
    video_url: "/videos/TVgpq7hgzd/final_filename.mp4",  // ✅ Финальный путь
    processing_status: "completed"
  }]
}
✅ Updated existing videos with final paths
```

### 2. Проверьте Network tab

Должны быть запросы:
1. `PUT /api/products/9` - обновление продукта
2. `GET /api/products/9` - получение свежих данных (через 2 сек)

### 3. Проверьте видео

Видео должно:
- ✅ Воспроизводиться из `/videos/{org_id}/final.mp4`
- ✅ Иметь водяной знак
- ✅ Быть сжатым (~800k bitrate)

## Временные рамки

- **0 sec**: User clicks Save
- **0.5 sec**: PUT request completes
- **2.0 sec**: GET request for fresh data
- **2.5 sec**: UI updates with final video paths
- **30-120 sec**: Celery completes processing (background)
- **120+ sec**: User can see processed video on page reload

## Примечания

1. **Задержка 2 секунды** нужна чтобы:
   - Backend успел создать запись о продукте
   - Запустилась Celery задача
   - БД обновила статус обработки

2. **Если видео не обновилось**:
   - Проверьте логи консоли
   - Проверьте Network tab
   - Перезагрузите страницу (hard refresh Ctrl+Shift+R)

3. **Для AddPart.jsx** аналогичное исправление будет добавлено

## Будущие улучшения

1. **WebSocket подключение** для real-time обновления статуса
2. **Polling статуса** пока Celery обрабатывает
3. **Progress bar** с прогрессом обработки
4. **Уведомление** когда обработка завершена
