# ⚡ Краткая инструкция по настройке Celery для Linux

## 🎯 Быстрый старт (3 команды)

```bash
# 1. Перейдите в директорию backend
cd backend

# 2. Сделайте скрипт исполняемым
chmod +x setup-celery.sh

# 3. Запустите настройку
sudo ./setup-celery.sh
```

**Всё!** 🎉 Celery настроен и запущен.

---

## 📊 Что делает скрипт?

1. ✅ Проверяет и устанавливает **FFmpeg**
2. ✅ Проверяет и настраивает **Redis**
3. ✅ Устанавливает **Python зависимости**
4. ✅ Создаёт пользователя **www-data**
5. ✅ Настраивает **права доступа**
6. ✅ Устанавливает **systemd службу** Celery
7. ✅ Оптимизирует под ваше количество **CPU ядер**

---

## 🔧 Ручная настройка (если нужно)

### 1. Обновите `celery_app.py`:
```python
task_time_limit=600,  # 10 минут для видео
worker_prefetch_multiplier=1,
worker_max_tasks_per_child=100,
task_acks_late=True,
task_reject_on_worker_lost=True,
```

### 2. Обновите `video_utils.py`:
```python
threads=1  # Вместо 0 для Linux
preset="ultrafast"
```

### 3. Запустите Celery вручную:
```bash
# Узнать количество CPU ядер
nproc

# Запустить с нужным количеством процессов
celery -A app.celery_app worker \
    --loglevel=INFO \
    --concurrency=4 \  # По количеству ядер
    --pool=prefork
```

---

## 📈 Ожидаемый результат

| До настройки | После настройки |
|--------------|-----------------|
| 60 секунд    | 5-10 секунд     |
| 1 видео/мин  | 6-12 видео/мин  |

**Ускорение: в 6-12 раз!** 🚀

---

## 🔍 Проверка работы

```bash
# Статус службы
sudo systemctl status celery

# Логи в реальном времени
sudo journalctl -u celery -f

# Активные задачи
celery -A app.celery_app inspect active

# Статистика
celery -A app.celery_app inspect stats
```

---

## 🆘 Если что-то пошло не так

### Celery не запускается:
```bash
# Проверьте логи
sudo journalctl -u celery -f

# Перезапустите
sudo systemctl restart celery
```

### Видео всё ещё медленное:
1. Проверьте загрузку CPU: `htop`
2. Увеличьте `--concurrency` (но не больше CPU ядер)
3. Убедитесь, что `threads=1` в `video_utils.py`
4. Используйте `preset="ultrafast"`

### Ошибки Redis:
```bash
sudo systemctl status redis
sudo systemctl restart redis
```

---

## 📚 Файлы для настройки

- `celery_app.py` - конфигурация Celery
- `video_tasks.py` - задачи обработки видео
- `video_utils.py` - утилиты FFmpeg
- `celery-systemd.service` - systemd служба
- `setup-celery.sh` - скрипт автоматической настройки
- `CELERY_LINUX_SETUP.md` - полная документация

---

## 💡 Советы

1. **Concurrency**: Ставьте по количеству CPU ядер, но не больше
2. **Threads**: Всегда `threads=1` для Linux (аппаратное ускорение)
3. **Preset**: Используйте `ultrafast` для скорости
4. **Мониторинг**: Установите Flower для веб-интерфейса
5. **Логи**: Настройте сбор логов в файл

---

**Готово!** Ваше видео должно загружаться за **5-10 секунд** вместо минуты! ⚡
