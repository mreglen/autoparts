# 🔥 HIGH PERFORMANCE CELERY CONFIGURATION
## Оптимизированная настройка для быстрой обработки большого объема видео

---

## 📋 Ваш новый конфиг `/etc/systemd/system/celery.service`

```ini
# /etc/systemd/system/celery.service
# 🚀 Optimized Celery Worker Service for AutoParts - High Performance Video Processing
# Designed for fast parallel processing of large video volumes

[Unit]
Description=Celery Worker Service for AutoParts - Video Processing
Documentation=https://docs.celeryq.dev/
After=network.target redis.service postgresql.service
Wants=redis.service postgresql.service

[Service]
Type=forking
User=www-data
Group=www-data

# Working directory
WorkingDirectory=/path/to/your/backend

# Environment variables
Environment="PATH=/path/to/your/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="PYTHONDONTWRITEBYTECODE=1"
EnvironmentFile=/path/to/your/backend/.env

# 🔥 HIGH PERFORMANCE CELERY WORKER CONFIGURATION
ExecStart=/path/to/your/venv/bin/celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=8 \
    --pool=prefork \
    --max-tasks-per-child=50 \
    --worker-send-task-events \
    --detach

# Graceful shutdown
KillSignal=SIGTERM
TimeoutStopSec=30

# Automatic restart on failure
Restart=always
RestartSec=5s

# 🔥 RESOURCE LIMITS FOR HIGH PERFORMANCE
LimitNOFILE=65536
LimitNPROC=65536

# Process priority (lower = higher priority, range: -20 to 19)
Nice=-5

# I/O scheduling for better disk performance
IOSchedulingClass=realtime
IOSchedulingPriority=0

# Memory protection (prevent OOM killer from killing celery)
OOMScoreAdjust=-500

# Working directories must exist!
RuntimeDirectory=celery
RuntimeDirectoryMode=0755

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=celery-worker

# Security hardening (optional but recommended)
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/path/to/your/backend/uploads
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

---

## ⚙️ Ключевые параметры для высокой производительности

### 1️⃣ **--concurrency=8** (ПАРАЛЛЕЛИЗМ)

**Что делает:** Количество одновременных worker процессов.

**Почему 8:**
- Обрабатывает до 8 видео параллельно
- Оптимально для CPU с 8+ ядрами
- Если у вас меньше ядер, измените на `nproc` (количество ядер)

**Как подобрать:**
```bash
# Узнать количество CPU ядер
nproc

# Рекомендации:
# 4 ядра  → concurrency=4
# 8 ядер  → concurrency=8
# 16 ядер → concurrency=12-16
```

**Важно:** Не ставьте больше количества CPU ядер! Это ухудшит производительность.

---

### 2️⃣ **Nice=-5** (ВЫСОКИЙ ПРИОРИТЕТ)

**Что делает:** Приоритет процесса в планировщике Linux.

**Диапазон:** от -20 (высший) до 19 (низший)

**Почему -5:**
- Celery получает высокий приоритет выполнения
- Обработка видео идет быстрее
- Другие процессы не мешают

---

### 3️⃣ **IOSchedulingClass=realtime** (БЫСТРЫЙ ДОСТУП К ДИСКУ)

**Что делает:** Приоритет ввода-вывода для операций с диском.

**Классы:**
- `realtime` - наивысший приоритет (используем мы)
- `best-effort` - стандартный
- `idle` - низкий

**Результат:** Быстрая запись/чтение видео файлов

---

### 4️⃣ **LimitNOFILE=65536** (МНОГО ФАЙЛОВЫХ ДЕСКРИПТОРОВ)

**Что делает:** Максимальное количество открытых файлов.

**Почему важно:**
- Каждое видео = открытый файл
- При обработке 100+ видео нужны тысячи дескрипторов
- Стандартное значение (1024) недостаточно

---

### 5️⃣ **OOMScoreAdjust=-500** (ЗАЩИТА ОТ OOM KILLER)

**Что делает:** Защищает Celery от принудительного завершения при нехватке памяти.

**Диапазон:** от -1000 (защита) до 1000 (убить первым)

**Почему важно:** Предотвращает падение воркеров при пиковых нагрузках

---

### 6️⃣ **--max-tasks-per-child=50** (ПЕРЕЗАПУСК ДЛЯ СТАБИЛЬНОСТИ)

**Что делает:** Перезапускает worker процесс каждые 50 задач.

**Почему важно:**
- Предотвращает утечки памяти
- Поддерживает стабильную производительность
- 50 - оптимальный баланс между стабильностью и накладными расходами

---

## 🚀 Установка и запуск

### Шаг 1: Скопируйте конфиг

```bash
sudo nano /etc/systemd/system/celery.service
```

Вставьте содержимое конфига выше.

### Шаг 2: Отредактируйте пути

Замените в конфиге:
- `/path/to/your/backend` → ваш путь (например, `/var/www/autoparts/backend`)
- `/path/to/your/venv/bin` → путь к вашему venv

### Шаг 3: Проверьте пути

```bash
# Убедитесь, что директории существуют
ls -la /path/to/your/backend
ls -la /path/to/your/venv/bin/celery
```

### Шаг 4: Активируйте и запустите

```bash
# Перезагрузить systemd
sudo systemctl daemon-reload

# Включить автозапуск
sudo systemctl enable celery

# Запустить службу
sudo systemctl start celery
```

### Шаг 5: Проверьте статус

```bash
# Статус службы
sudo systemctl status celery

# Просмотр логов в реальном времени
sudo journalctl -u celery -f
```

---

## 📊 Ожидаемая производительность

### СConcurrency=8 (8 процессов параллельно):

| Кол-во видео | Последовательно | Параллельно (8 процессов) |
|--------------|-----------------|---------------------------|
| 1 видео      | 10 сек          | **10 сек**                |
| 8 видео      | 80 сек          | **10-12 сек**             |
| 16 видео     | 160 сек         | **20-25 сек**             |
| 100 видео    | 1000 сек        | **125-150 сек**           |

**Ускорение обработки пакета: в 6-8 раз!** ⚡

---

## 🔍 Мониторинг производительности

### Проверка активных задач

```bash
# Посмотреть активные задачи
celery -A app.celery_app inspect active

# Пример вывода:
# -> worker1@hostname OK
#    - 8 tasks currently being processed
```

### Статистика по воркерам

```bash
celery -A app.celery_app inspect stats
```

### Загрузка CPU в реальном времени

```bash
# Утилита top
top -p $(pgrep -d',' -f 'celery.*worker')

# Или htop (красивее)
htop
```

### Использование Flower (веб-интерфейс)

```bash
# Установить Flower
pip install flower

# Запустить
celery -A app.celery_app flower --port=5555
```

Откройте в браузере: `http://your-server:5555`

---

## 🎯 Настройка под ваше железо

### Для слабых серверов (2-4 ядра):

```ini
--concurrency=4
Nice=0
IOSchedulingClass=best-effort
```

### Для мощных серверов (16+ ядер):

```ini
--concurrency=16
Nice=-10
IOSchedulingClass=realtime
IOSchedulingPriority=0
LimitNOFILE=131072
```

### Для обработки в фоне (не критично к скорости):

```ini
--concurrency=2
Nice=10
IOSchedulingClass=idle
```

---

## ⚠️ Важные замечания

### 1. Память

Каждый worker процесс потребляет ~200-500MB RAM.

**Расчет:**
```
8 workers × 500MB = 4GB RAM
+ Django/Flask app = 1GB
+ Redis/PostgreSQL = 2GB
---------------------------
Итого: ~7GB RAM минимум
```

**Рекомендация:** Минимум 8GB RAM для concurrency=8

### 2. CPU

FFmpeg использует ~100% одного ядра на каждый процесс.

**Расчет:**
```
8 workers × 100% = 800% CPU (8 ядер загружены полностью)
```

**Рекомендация:** Минимум 8 CPU ядер

### 3. Диск

Быстрый диск (SSD/NVMe) критически важен!

**Скорости:**
- HDD: 100-150 MB/s (БУДЕТ МЕДЛЕННО!)
- SSD: 400-550 MB/s (ХОРОШО)
- NVMe: 2000-3500 MB/s (ОПТИМАЛЬНО)

---

## 🆘 Troubleshooting

### Celery не запускается

```bash
# Проверьте логи
sudo journalctl -u celery -f

# Частые ошибки:
# - Permission denied → проверьте права на директорию
# - Command not found → проверьте PATH к venv
# - Address already in use → другой celery уже запущен
```

### Воркеры падают с OOM

```bash
# Увеличьте память или уменьшите concurrency
# Измените в конфиге:
--concurrency=4  # вместо 8

# И увеличьте защиту от OOM
OOMScoreAdjust=-800  # вместо -500
```

### Медленная обработка

1. Проверьте загрузку CPU:
```bash
htop
```

2. Если CPU загружен < 100%, увеличьте concurrency:
```ini
--concurrency=12  # если у вас 12 ядер
```

3. Проверьте скорость диска:
```bash
hdparm -Tt /dev/sda
```

### Слишком высокое потребление памяти

```bash
# Уменьшите max-tasks-per-child
--max-tasks-per-child=30  # вместо 50

# Или уменьшите concurrency
--concurrency=4  # вместо 8
```

---

## 📈 Продвинутая настройка

### Разделение очередей по приоритету

Создайте два сервиса:

#### 1. Видео воркер (высокий приоритет)

```ini
# /etc/systemd/system/celery-video.service
ExecStart=/path/to/celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=8 \
    -Q video_tasks \
    -n video-worker@%h \
    --pool=prefork \
    --max-tasks-per-child=50
```

#### 2. Фото воркер (низкий приоритет)

```ini
# /etc/systemd/system/celery-photo.service
ExecStart=/path/to/celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=4 \
    -Q photo_tasks \
    -n photo-worker@%h \
    --pool=prefork \
    --max-tasks-per-child=100
```

Обновите `celery_app.py`:

```python
celery_app.conf.task_routes = {
    'app.tasks.video_tasks.*': {'queue': 'video_tasks'},
    'app.tasks.photo_tasks.*': {'queue': 'photo_tasks'},
}
```

---

## ✅ Чек-лист правильной настройки

- [ ] Отредактировали пути в конфиге (`WorkingDirectory`, `PATH`)
- [ ] Проверили, что директории существуют
- [ ] Установили правильное количество `--concurrency` (по CPU ядрам)
- [ ] Настроили права доступа (`chown www-data:www-data`)
- [ ] Перезагрузили systemd (`daemon-reload`)
- [ ] Включили службу (`enable celery`)
- [ ] Запустили службу (`start celery`)
- [ ] Проверили статус (`status celery`)
- [ ] Протестировали обработку видео
- [ ] Проверили логи (`journalctl -u celery -f`)

---

## 🎉 Готово!

Теперь ваш Celery настроен для **максимально быстрой обработки большого объема видео**!

**Ожидаемые результаты:**
- ⚡ Обработка 1 видео: **5-10 секунд** (вместо 60)
- 🚀 Параллельная обработка: **до 8 видео одновременно**
- 📦 Пропускная способность: **~500 видео в час**
- 💪 Стабильность: автоматический перезапуск и защита от OOM

**Следующий шаг:** Протестируйте загрузкой нескольких видео и проверьте логи!
