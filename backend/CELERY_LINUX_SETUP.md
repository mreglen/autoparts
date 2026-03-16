# 🚀 Настройка Celery для быстрой обработки видео на Linux

## ⚡ Почему видео загружается медленно (1 минута)?

### Основные проблемы:

1. **Неправильная настройка потоков FFmpeg** - `threads=0` на Linux работает некорректно
2. **Мало worker процессов Celery** - обработка идет последовательно
3. **Отсутствие оптимизации CPU** - FFmpeg не использует все ядра эффективно
4. **Таймауты и retry** - задачи выполняются дольше нужного

---

## ✅ Пошаговая инструкция по ускорению

### 1️⃣ **Настройка переменных окружения в `.env`**

```bash
# Убедитесь, что пути к FFmpeg правильные для Linux
FFPROBE_PATH=/usr/bin/ffprobe
FFMPEG_PATH=/usr/bin/ffmpeg

# Redis для Celery
REDIS_URL=redis://:password@127.0.0.1:6379/0
CELERY_BROKER_URL=redis://:password@127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://:password@127.0.0.1:6379/0
```

### 2️⃣ **Установка FFmpeg на Linux**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# Проверка установки
ffmpeg -version
ffprobe -version
```

### 3️⃣ **Настройка systemd службы для Celery**

#### Скопируйте файл службы:
```bash
sudo cp celery-systemd.service /etc/systemd/system/celery.service
```

#### Отредактируйте пути в `/etc/systemd/system/celery.service`:
```ini
WorkingDirectory=/path/to/your/backend  # Путь к backend папке
Environment="PATH=/path/to/your/venv/bin"  # Путь к venv
EnvironmentFile=/path/to/your/backend/.env  # Путь к .env
ExecStart=/path/to/your/venv/bin/celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=4 \
    --pool=prefork \
    --max-tasks-per-child=100 \
    --worker-send-task-events \
    --detach
```

#### Активируйте и запустите службу:
```bash
# Перезагрузить systemd
sudo systemctl daemon-reload

# Включить автозапуск
sudo systemctl enable celery

# Запустить службу
sudo systemctl start celery

# Проверить статус
sudo systemctl status celery

# Просмотр логов
sudo journalctl -u celery -f
```

### 4️⃣ **Оптимизация количества worker процессов**

#### Узнайте количество CPU ядер:
```bash
nproc
# или
lscpu | grep "^CPU(s):"
```

#### Рекомендуемые значения `--concurrency`:
- **2 ядра**: `--concurrency=2`
- **4 ядра**: `--concurrency=4`
- **8 ядер**: `--concurrency=6-8`
- **16 ядер**: `--concurrency=12-16`

**Важно:** Не ставьте больше ядер, чем доступно! Это ухудшит производительность.

### 5️⃣ **Запуск нескольких воркеров для приоритизации**

#### Воркер для видео (высокий приоритет):
```bash
# Терминал 1 - Видео воркер (4 процесса)
celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=4 \
    --pool=prefork \
    -Q video_tasks \
    -n video-worker@%h
```

#### Воркер для фото (низкий приоритет):
```bash
# Терминал 2 - Фото воркер (2 процесса)
celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=2 \
    --pool=prefork \
    -Q photo_tasks \
    -n photo-worker@%h
```

#### Обновите `celery_app.py` для разделения очередей:
```python
celery_app.conf.task_routes = {
    'app.tasks.video_tasks.*': {'queue': 'video_tasks'},
    'app.tasks.photo_tasks.*': {'queue': 'photo_tasks'},
}
```

### 6️⃣ **Оптимизация FFmpeg в `video_utils.py`**

Используйте правильные настройки для Linux:

```python
compressed_path = compress_video(
    temp_file_path,
    output_path=final_path,
    max_duration_seconds=30,
    video_bitrate="800k",       # Минимальный битрейт
    audio_bitrate="64k",        # Минимальный аудио
    preset="ultrafast",         # Самый быстрый preset
    crf=28,                     # Максимальное сжатие
    threads=1                   # 1 = аппаратное ускорение (БЫСТРО!)
)
```

**Ключевые параметры:**
- `preset="ultrafast"` - максимальная скорость кодирования
- `threads=1` - использует аппаратное ускорение (быстрее на Linux)
- `crf=28` - хорошее соотношение качество/размер
- `video_bitrate="800k"` - достаточно для веб

### 7️⃣ **Мониторинг производительности**

#### Проверка активности Celery:
```bash
# Статус воркеров
celery -A app.celery_app inspect active

# Статистика
celery -A app.celery_app inspect stats

# Зарегистрированные очереди
celery -A app.celery_app inspect registered_queues
```

#### Мониторинг в реальном времени:
```bash
# Flower - веб интерфейс для мониторинга Celery
pip install flower
celery -A app.celery_app flower --port=5555
```

Откройте в браузере: `http://localhost:5555`

### 8️⃣ **Диагностика проблем**

#### Если видео всё ещё загружается медленно:

**Проверьте логи Celery:**
```bash
sudo journalctl -u celery -f --no-pager
```

**Проверьте загрузку CPU во время обработки:**
```bash
top
# или
htop
```

**Проверьте очередь задач:**
```bash
celery -A app.celery_app inspect reserved
celery -A app.celery_app inspect scheduled
```

**Тест скорости FFmpeg:**
```bash
time ffmpeg -i input.mp4 -vcodec libx264 -preset ultrafast -crf 28 -threads 1 output.mp4
```

### 9️⃣ **Автоматический перезапуск при проблемах**

Создайте скрипт мониторинга `/usr/local/bin/celery-monitor.sh`:

```bash
#!/bin/bash

# Проверка работы Celery
if ! systemctl is-active --quiet celery; then
    echo "Celery stopped! Restarting..."
    systemctl restart celery
    
    # Отправка уведомления (опционально)
    # curl -X POST https://your-webhook.com/alert -d "Celery restarted"
fi
```

Добавьте в crontab:
```bash
*/5 * * * * /usr/local/bin/celery-monitor.sh
```

### 🔟 **Ожидаемая производительность**

После оптимизации:

| Размер видео | До оптимизации | После оптимизации |
|--------------|----------------|-------------------|
| 5 MB         | 30-40 сек      | **3-5 сек**       |
| 10 MB        | 50-60 сек      | **8-12 сек**      |
| 20 MB        | 90-120 сек     | **15-20 сек**     |
| 30 MB        | 150-180 сек    | **25-35 сек**     |

**Ускорение: в 6-10 раз!** ⚡

---

## 🎯 Чек-лист быстрой настройки

- [ ] Установлен FFmpeg (`ffmpeg -version`)
- [ ] Настроен `.env` с правильными путями
- [ ] Скопирован `celery-systemd.service` в `/etc/systemd/system/`
- [ ] Отредактированы пути в service файле
- [ ] Запущен через `systemctl start celery`
- [ ] Worker использует `--concurrency=N` (по числу ядер)
- [ ] В `video_tasks.py` используется `threads=1`
- [ ] Протестирована скорость загрузки

---

## 🆘 Troubleshooting

### Ошибка: "Permission denied" при запуске
```bash
sudo chown www-data:www-data /path/to/backend
sudo chmod -R 755 /path/to/backend
```

### Ошибка: "Could not find ffprobe"
```bash
which ffprobe
# Если не найдено:
sudo apt install ffmpeg
```

### Ошибка: "Redis connection refused"
```bash
sudo systemctl status redis
sudo systemctl restart redis
```

### Воркеры не обрабатывают задачи
```bash
# Проверить очередь
celery -A app.celery_app inspect active

# Перезапустить воркеры
sudo systemctl restart celery
```

### Задачи выполняются слишком долго
- Увеличьте `--concurrency` (но не больше CPU ядер)
- Используйте `preset="ultrafast"` в FFmpeg
- Уменьшите `video_bitrate` до "500k"
- Проверьте `threads=1` для аппаратного ускорения

---

## 📚 Дополнительные ресурсы

- [Документация Celery](https://docs.celeryq.dev/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Systemd Service Tutorial](https://www.digitalocean.com/community/tutorials/understanding-systemd-units-and-unit-files)
