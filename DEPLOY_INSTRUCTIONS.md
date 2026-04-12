# Инструкция по деплою исправлений Avito URL на хостинг

## Что было исправлено

### 1. PUBLIC_BASE_URL в .env
**Было**: `https://svoygarage.ru`  
**Стало**: `https://svoygarage.ru/server`

Теперь все URL фотографий будут правильными:
```
https://svoygarage.ru/server/uploads/pictures/{org_id}/{file}.webp
```

### 2. Добавлена оптимизация nginx
Создан файл `nginx-config-optimized.conf` с прямой раздачей статики через nginx (быстрее).

---

## Шаг 1: Обновить .env на хостинге

### Подключитесь к серверу:
```bash
ssh ваш_пользователь@195.24.65.251
```

### Откройте файл .env:
```bash
cd /home/fast/autoparts/backend
nano .env
```

### Найдите и измените строку PUBLIC_BASE_URL:
```env
# Было:
# PUBLIC_BASE_URL = 'https://svoygarage.ru/server/'

# Стало:
PUBLIC_BASE_URL = 'https://svoygarage.ru/server'
```

**Важно**: Без слэша `/` в конце!

### Сохраните и выйдите:
- `Ctrl + O` → Enter (сохранить)
- `Ctrl + X` (выйти)

---

## Шаг 2: Загрузить обновленный код

### Вариант A: Если используете Git
```bash
cd /home/fast/autoparts
git pull origin main
```

### Вариант B: Загрузка файлов вручную

Загрузите эти файлы на сервер через FTP/SCP:

1. `backend/.env` (измененный)
2. `backend/app/tasks/photo_tasks.py` (обновленные комментарии)
3. `backend/app/services/avito_media.py` (обновленная документация)

```bash
# Пример через SCP (с локального компьютера):
scp backend/.env ваш_пользователь@195.24.65.251:/home/fast/autoparts/backend/
scp backend/app/tasks/photo_tasks.py ваш_пользователь@195.24.65.251:/home/fast/autoparts/backend/app/tasks/
scp backend/app/services/avito_media.py ваш_пользователь@195.24.65.251:/home/fast/autoparts/backend/app/services/
```

---

## Шаг 3: Обновить nginx конфигурацию (РЕКОМЕНДУЕТСЯ)

Это ускорит загрузку фотографий в 5-10 раз!

### Скопируйте новый конфиг:
```bash
# Сначала сделайте бэкап старого конфига
sudo cp /etc/nginx/sites-available/svoygarage.ru /etc/nginx/sites-available/svoygarage.ru.backup

# Скопируйте новый конфиг (загрузите файл nginx-config-optimized.conf на сервер)
sudo cp /путь/к/nginx-config-optimized.conf /etc/nginx/sites-available/svoygarage.ru
```

### ИЛИ вручную отредактируйте текущий конфиг:
```bash
sudo nano /etc/nginx/sites-available/svoygarage.ru
```

### Добавьте этот блок ПЕРЕД `location /server/`:
```nginx
# Статические файлы через /server/uploads/ (ПРИОРИТЕТ - БЫСТРАЯ РАЗДАЧА!)
location /server/uploads/ {
    alias /home/fast/autoparts/backend/uploads/;
    expires 30d;
    add_header Cache-Control "public, immutable";
    # Важно: этот location должен быть ПЕРЕД общим /server/
}
```

### Проверьте конфиг на ошибки:
```bash
sudo nginx -t
```

Если видите `syntax is ok` и `test is successful`:

### Перезапустите nginx:
```bash
sudo systemctl restart nginx
```

---

## Шаг 4: Перезапустить сервисы

### Перезапустить backend:
```bash
# Если используете systemctl:
sudo systemctl restart autoparts-backend

# ИЛИ если используете supervisor:
sudo supervisorctl restart autoparts-backend

# ИЛИ если запущен вручную:
# 1. Найдите процесс:
ps aux | grep uvicorn
# 2. Убейте процесс:
kill -9 <PID>
# 3. Запустите заново:
cd /home/fast/autoparts/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```

### Перезапустить Celery worker:
```bash
# Если используете systemctl:
sudo systemctl restart celery-worker

# ИЛИ если используете supervisor:
sudo supervisorctl restart celery

# ИЛИ вручную:
# 1. Найдите процесс:
ps aux | grep celery
# 2. Убейте процесс:
kill -9 <PID>
# 3. Запустите заново:
cd /home/fast/autoparts/backend
celery -A app.celery_app worker --loglevel=info --concurrency=4
```

---

## Шаг 5: Проверить что все работает

### 1. Проверить PUBLIC_BASE_URL:
```bash
cd /home/fast/autoparts/backend
python3 -c "from app.core.config import settings; print(settings.PUBLIC_BASE_URL)"
```

**Должно вывести**: `https://svoygarage.ru/server`

### 2. Проверить URL фото в базе данных:
```bash
psql -U postgres -d autoparts
```

```sql
-- Посмотреть примеры путей фото
SELECT id, photo_url, processing_status 
FROM product_photos 
LIMIT 10;

-- Пути должны быть вида: /uploads/pictures/{org_id}/{file}.webp
```

### 3. Проверить что фото открываются в браузере:

Откройте в браузере:
```
https://svoygarage.ru/server/uploads/pictures/TVgpq7hgzd/TVgpq7hgzd_20260412_135426_TVgpq7hgzd_20260412_135424_2ec81d1f.webp
```

**Должно отобразиться фото** ✅

### 4. Проверить через curl:
```bash
curl -I https://svoygarage.ru/server/uploads/pictures/TVgpq7hgzd/TVgpq7hgzd_20260412_135426_TVgpq7hgzd_20260412_135424_2ec81d1f.webp
```

**Должно вернуть**:
```
HTTP/2 200 
content-type: image/webp
content-length: 123456
cache-control: public, immutable
expires: ...
```

---

## Шаг 6: Протестировать экспорт/импорт Avito

### Тест экспорта:
1. Зайдите на `https://svoygarage.ru/my-parts`
2. Выберите товар с фото
3. Нажмите "Действия" → "Экспорт в Avito"
4. Дождитесь завершения
5. Скачайте XLSX файл
6. Откройте его и проверьте колонку `ImageUrls`

**URL должны быть вида**:
```
https://svoygarage.ru/server/uploads/pictures/TVgpq7hgzd/photo.webp
```

### Тест импорта:
1. Зайдите на `https://svoygarage.ru/settings/integration/avito/nomenclature`
2. Загрузите файл autoload.xlsx от Avito (с внешними ссылками на фото)
3. Выберите строки для импорта
4. Нажмите "Импортировать"
5. Проверьте что товары созданы с фото

---

## Шаг 7: Исправить старые фото (ЕСЛИ НУЖНО)

Если у вас уже есть товары с неправильными путями в БД (например `/pictures/...` вместо `/uploads/pictures/...`), выполните:

```bash
psql -U postgres -d autoparts
```

```sql
-- Проверить есть ли старые пути
SELECT COUNT(*) FROM product_photos WHERE photo_url LIKE '/pictures/%';
SELECT COUNT(*) FROM product_photos WHERE photo_url LIKE '/uploads/pictures/%';

-- Если есть старые пути, исправить их:
UPDATE product_photos 
SET photo_url = CONCAT('/uploads', photo_url)
WHERE photo_url LIKE '/pictures/%'
  AND photo_url NOT LIKE '/uploads/%';

-- Проверить видео
UPDATE product_videos 
SET video_url = CONCAT('/uploads', video_url)
WHERE video_url LIKE '/videos/%'
  AND video_url NOT LIKE '/uploads/%';

-- Проверить что исправили
SELECT COUNT(*) FROM product_photos WHERE photo_url LIKE '/pictures/%';
-- Должно быть: 0
```

---

## Возможные проблемы и решения

### Проблема 1: Фото не открываются (404)

**Причина**: nginx не находит файлы

**Решение**:
```bash
# Проверить права на папку uploads
ls -la /home/fast/autoparts/backend/
ls -la /home/fast/autoparts/backend/uploads/

# Должно быть可读 для www-data/nginx
sudo chown -R fast:fast /home/fast/autoparts/backend/uploads/
sudo chmod -R 755 /home/fast/autoparts/backend/uploads/

# Проверить nginx error log
sudo tail -f /var/log/nginx/svoygarage_ssl_error.log
```

### Проблема 2: Backend не запускается

**Причина**: Ошибка в .env файле

**Решение**:
```bash
# Проверить синтаксис .env
cat /home/fast/autoparts/backend/.env | grep PUBLIC_BASE_URL

# Должно быть без кавычек и без слэша в конце:
# PUBLIC_BASE_URL = 'https://svoygarage.ru/server'

# Проверить логи backend
sudo journalctl -u autoparts-backend -n 50
```

### Проблема 3: Celery не обрабатывает фото

**Причина**: Worker не запущен или ошибка

**Решение**:
```bash
# Проверить статус celery
sudo systemctl status celery-worker
# ИЛИ
sudo supervisorctl status celery

# Проверить логи celery
sudo tail -f /var/log/celery/worker.log
# ИЛИ
sudo journalctl -u celery-worker -n 50

# Перезапустить celery
sudo systemctl restart celery-worker
```

### Проблема 4: nginx не принимает конфиг

**Причина**: Синтаксическая ошибка

**Решение**:
```bash
# Проверить конфиг
sudo nginx -t

# Если ошибка - посмотреть что не так
# Обычно это:
# - Опечатка в директиве
# - Отсутствие точки с запятой ;
# - Неправильный путь к файлам

# Вернуть бэкап если что-то пошло не так
sudo cp /etc/nginx/sites-available/svoygarage.ru.backup /etc/nginx/sites-available/svoygarage.ru
sudo systemctl restart nginx
```

---

## Чеклист после деплоя

- [ ] PUBLIC_BASE_URL = `https://svoygarage.ru/server` (без слэша)
- [ ] Backend перезапущен
- [ ] Celery worker перезапущен
- [ ] nginx перезапущен (если обновляли конфиг)
- [ ] Фото открываются по URL: `https://svoygarage.ru/server/uploads/pictures/...`
- [ ] Экспорт в Avito создает правильные URL в XLSX
- [ ] Импорт из Avito скачивает и обрабатывает фото
- [ ] Старые фото в БД исправлены (если были проблемы)

---

## Контакты для поддержки

Если что-то пошло не так:
1. Проверьте логи nginx: `sudo tail -f /var/log/nginx/svoygarage_ssl_error.log`
2. Проверьте логи backend: `sudo journalctl -u autoparts-backend -n 100`
3. Проверьте логи celery: `sudo journalctl -u celery-worker -n 100`
4. Проверьте что сервисы запущены: `sudo systemctl status nginx autoparts-backend celery-worker`
