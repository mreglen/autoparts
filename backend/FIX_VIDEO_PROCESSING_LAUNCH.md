# Решение проблемы с запуском обработки видео

## 🎯 Проблема

Видео загружается быстро в temp папку, но после сохранения продукта обработка **НЕ запускается**.

## 🔍 Причина

Backend пытался вызвать сам себя через публичный URL:
```python
BASE_URL = 'https://svoygarage.ru/server/'
```

Это не работало из-за network конфигурации.

## ✅ Решение

### 1. Обновлён `.env` файл:

```bash
# BASE_URL для внутренних вызовов API (используем localhost)
BASE_URL = 'http://localhost:8000'

# PUBLIC_BASE_URL для фронтенда и внешних ссылок
PUBLIC_BASE_URL = 'https://svoygarage.ru/server/'
```

### 2. Обновлён `config.py`:

Добавлено поле `PUBLIC_BASE_URL` для разделения внутреннего и публичного доступа.

### 3. Добавлены отладочные логи в `products.py`:

Теперь вы увидите в логах backend:
```
=== UPDATING VIDEOS FOR PRODUCT 3 ===
Received videos: ['/temp/TVgpq7hgzd/5bc90469dd324ba8a3646f5943fe4eac.mp4']
Created video record ID 10 with URL: /temp/TVgpq7hgzd/5bc90469dd324ba8a3646f5943fe4eac.mp4
Total video IDs to process: [10]
Starting video processing for 1 video(s)...
Calling: http://localhost:8000/api/upload/start-video-processing/10
✅ Started processing for updated video 10: Status 200
Response: {'success': True, 'task_id': 'abc-123', ...}
```

## 🚀 Инструкция по применению

### Шаг 1: Перезапустите Backend

```bash
# На Linux сервере
sudo systemctl restart your_backend_service

# Или если запускаете вручную
pkill -f "uvicorn|gunicorn"
cd /home/fast/autoparts/backend
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /var/log/backend.log 2>&1 &
```

### Шаг 2: Проверьте логи Backend

```bash
# В одном терминале следите за логами
tail -f /var/log/backend.log | grep -E "(UPDATING VIDEOS|start-video-processing)"

# Или через journalctl если используете systemd
sudo journalctl -u your_backend_service -f | grep -E "(UPDATING VIDEOS|start-video-processing)"
```

### Шаг 3: Протестируйте

1. Откройте `/my-parts/edit/3`
2. Загрузите новое видео
3. Нажмите "Сохранить"
4. **Смотрите логи backend** - должны появиться:
   ```
   === UPDATING VIDEOS FOR PRODUCT 3 ===
   Calling: http://localhost:8000/api/upload/start-video-processing/...
   ✅ Started processing...
   ```

### Шаг 4: Проверьте Celery

Через 30-120 секунд проверьте логи Celery:

```bash
sudo journalctl -u celery.service -f | grep -E "(VIDEO PROCESSING|Compressing|Watermark)"
```

Должно быть:
```
=== VIDEO PROCESSING TASK STARTED ===
⚡ Compressing video (MAXIMUM SPEED)...
✓ Video compressed successfully
Applying watermark to video...
✓ Watermark applied successfully
```

### Шаг 5: Проверьте результат

```bash
# Проверить финальный файл
ls -lh /home/fast/autoparts/backend/uploads/videos/TVgpq7hgzd/*.mp4

# Проверить БД
python3 /home/fast/autoparts/backend/check_video_status.py 3
```

Ожидаемый вывод:
```
Video URL: /videos/TVgpq7hgzd/final_filename.mp4
Processing Status: completed
✅ PROCESSED - Final video path
```

## 🐛 Если всё ещё не работает

### 1. Проверьте, что backend доступен на localhost:8000

```bash
curl http://localhost:8000/api/docs
```

Должен открыться Swagger UI.

### 2. Проверьте токен аутентификации

В логах должно быть:
```
Authorization: Bearer {token}
```

Если получаете 401 ошибку - проблема с токеном.

### 3. Проверьте firewall

```bash
# Убедитесь что порт 8000 открыт
sudo ufw status | grep 8000

# Если закрыт, откройте
sudo ufw allow 8000/tcp
```

### 4. Используйте tcpdump для отладки

```bash
# Посмотреть HTTP запросы на localhost
sudo tcpdump -i lo -A port 8000 | grep "start-video-processing"
```

## 📊 Контрольный чеклист

- [ ] Backend использует `BASE_URL = 'http://localhost:8000'`
- [ ] Backend перезапущен с новыми настройками
- [ ] В логах видно `Calling: http://localhost:8000/api/upload/start-video-processing/...`
- [ ] Response Status: 200
- [ ] Celery получает задачу
- [ ] Видео обрабатывается (сжатие + watermark)
- [ ] Финальный файл появляется в `/uploads/videos/`
- [ ] БД обновляется с правильным путём

## 💡 Примечания

1. **LOCALHOST vs PUBLIC**: 
   - Backend вызывает себя через `http://localhost:8000`
   - Frontend использует `https://svoygarage.ru/server/`

2. **Таймаут 5 секунд**: 
   - Вызов endpoint обработки имеет таймаут 5 сек
   - Это нормально - задача только ставится в очередь

3. **Асинхронность**:
   - Backend НЕ ждёт завершения обработки
   - Celery обрабатывает в фоне (30-120 сек)
