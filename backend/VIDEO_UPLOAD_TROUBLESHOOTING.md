# Troubleshooting: Видео загружается, но путь не сохраняется в БД

## Проблема
- Видео **успешно обрабатывается** (файл создаётся на сервере)
- Celery задача выполняется **успешно** (видно в логах)
- Но frontend **не получает результат** (таймаут polling)
- Запись в БД **не добавляется**

## Причины

### 1. Недостаточно времени на polling ⏰

**Frontend ждёт слишком мало:**
```javascript
const maxAttempts = 60; // 60 * 2 сек = 2 минуты
```

**Видео обрабатывается дольше:**
- Большое видео (>20MB) → 2-3 минуты
- Медленный сервер → ещё дольше

**Решение:** Увеличили `maxAttempts` до 90 (3 минуты)

---

### 2. Polling начинается слишком рано 🚦

**Проблема:** Frontend начинает опрос сразу после загрузки, но Celery задача ещё даже не началась (статус `PENDING`).

**Решение:** Добавить задержку перед первым опросом:

```javascript
// Ждём 3 секунды перед первым опросом
await new Promise(resolve => setTimeout(resolve, 3000));

for (let attempt = 0; attempt < maxAttempts; attempt++) {
  const statusResponse = await apiRequest(`/upload/photo-status/${task_id}`);
  // ...
}
```

---

### 3. Статус задачи не обновляется 🔍

**Проблема:** Celery возвращает кэшированный результат или статус не меняется.

**Проверка:**
```bash
# SSH на сервер
ssh user@svoygarage.ru

# Проверка статуса задачи напрямую через Redis CLI
redis-cli
KEYS *ad1d0eed*  # Ищем ключи с task_id
GET celery-task-meta-ad1d0eed-9a17-4b48-9a52-cb0c9885e041
```

**Решение:** Убедиться что Redis работает корректно:
```bash
sudo systemctl status redis
sudo journalctl -u redis -f
```

---

### 4. Backend не может подключиться к Redis 📡

**Проверка логов Celery:**
```bash
sudo tail -f /var/log/autoparts/celery-worker.log
```

**Ошибки подключения:**
```
[ERROR] Connection to Redis failed: Error 111
[ERROR] Could not connect to Redis at 127.0.0.1:6379
```

**Решение:**
```bash
# Проверка что Redis слушает порт
sudo netstat -tlnp | grep 6379

# Перезапуск Redis
sudo systemctl restart redis

# Проверка конфига Redis
cat /etc/redis/redis.conf | grep bind
# Должно быть: bind 127.0.0.1
```

---

### 5. Неправильный BASE_URL создает двойной слэш 🔗

**Проблема:** URL выглядит как `https://svoygarage.ru/server//videos/...`

**Решение:** Исправлено в [`photo_tasks.py`](c:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\tasks\photo_tasks.py#L254-L257) и [`video_tasks.py`](c:\Users\khram\OneDrive\Рабочий стол\autoparts\backend\app\tasks\video_tasks.py#L190-L193):

```python
base_url = settings.BASE_URL.rstrip('/')  # Убираем trailing slash
'url': f"{base_url}{media_path}"
```

---

## Диагностика по шагам

### Шаг 1: Проверить логи backend

```bash
# Логи uvicorn (backend)
sudo journalctl -u autoparts-backend -f

# Ищем строки:
"Video upload initiated"
"Polling attempt X/Y"
"Video processing complete"
```

### Шаг 2: Проверить логи Celery

```bash
# Логи Celery worker
sudo tail -f /var/log/autoparts/celery-worker.log

# Ищем:
"=== VIDEO PROCESSING TASK STARTED ==="
"✓ Video compressed successfully"
"Task succeeded"
```

### Шаг 3: Проверить Redis

```bash
# Статус Redis
sudo systemctl status redis

# Проверка ключей задач
redis-cli
KEYS celery-task-meta-*
GET celery-task-meta-{task_id}
```

### Шаг 4: Проверить наличие файла

```bash
# Файл должен существовать
ls -lh /home/fast/autoparts/backend/uploads/videos/{org_id}/

# Пример:
ls -lh /home/fast/autoparts/backend/uploads/videos/qMHbBIoD51/
```

### Шаг 5: Проверить polling вручную

```bash
# CURL запрос к endpoint статуса
curl https://svoygarage.ru/server/api/upload/photo-status/{task_id}

# Должен вернуть:
{
  "status": "completed",
  "url": "https://svoygarage.ru/server/videos/...",
  "path": "/videos/...",
  "filename": "..."
}
```

---

## Быстрое решение

### 1. Обновить код на сервере:

```bash
# Копируем frontend
scp frontend/my-autoparts/src/pages/MyParts/EditPart/EditPart.jsx user@svoygarage.ru:/var/www/svoygarage/src/pages/MyParts/EditPart/

# На сервере пересобрать frontend
cd /var/www/svoygarage
npm run build

# Перезапустить nginx
sudo systemctl restart nginx
```

### 2. Проверить что Celery worker запущен:

```bash
sudo systemctl status autoparts-celery-worker

# Если не работает - перезапустить
sudo systemctl restart autoparts-celery-worker

# Проверить логи
sudo journalctl -u autoparts-celery-worker -f
```

### 3. Увеличить таймауты в конфиге Nginx:

```nginx
# /etc/nginx/sites-available/svoygarage.ru
location /server/api/ {
    proxy_pass http://127.0.0.1:8000;
    
    # Увеличенные таймауты
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    
    # Для больших файлов
    client_max_body_size 100M;
}
```

---

## Проверка работы

### 1. Открыть консоль браузера (F12)

### 2. Загрузить видео

### 3. Смотреть логи:

```
🕐 Starting polling with maxAttempts: 90 (~ 3 minutes)
Waiting for video processing... Task ID: abc-123
📡 Polling attempt 1/90: pending
📡 Polling attempt 2/90: started
📡 Polling attempt 3/90: started
📡 Polling attempt 4/90: success
✅ Video processing complete!
   URL: https://svoygarage.ru/server/videos/...
   Path: /videos/...
   Filename: ...
✅ Video successfully uploaded with path: /videos/...
```

### 4. Проверить БД:

```sql
-- Подключиться к PostgreSQL
psql -U postgres -d autoparts

-- Проверить записи
SELECT id, title, video_path 
FROM products 
WHERE video_path IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;
```

---

## Если всё ещё не работает

### Временное решение: Вернуть синхронную загрузку

Если Celery не работает корректно, можно временно вернуть синхронную обработку:

**Файл:** `backend/app/routers/upload.py`

Заменить возврат ответа с `task_id` на ожидание результата (как было раньше).

**НО:** Это приведёт к таймаутам на больших видео!

---

## Правильное решение

1. ✅ Увеличить `maxAttempts` до 90 (сделано)
2. ✅ Добавить детальное логирование (сделано)
3. ✅ Проверить что Celery worker запущен
4. ✅ Проверить подключение к Redis
5. ✅ Протестировать загрузку маленького видео (5-10MB)
6. ✅ Постепенно увеличивать размер видео

---

## Контакты для помощи

При проблемах предоставить:
1. Логи браузера (консоль разработчика)
2. Логи backend (`journalctl -u autoparts-backend`)
3. Логи Celery (`tail -f /var/log/autoparts/celery-worker.log`)
4. Результат `curl` к `/api/upload/photo-status/{task_id}`
