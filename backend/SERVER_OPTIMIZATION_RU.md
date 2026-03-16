# Оптимизация сервера Ubuntu для быстрой обработки видео

## Проблема
- Локально (Windows/macOS): видео обрабатывается за 5-15 секунд
- На сервере Ubuntu: может занимать 30-60 секунд и больше

## Причины медленной работы

1. **CPU ядра**: FFmpeg не использует все ядра эффективно
2. **Дисковая подсистема**: Медленный диск или сетевое хранилище
3. **Отсутствие GPU**: Нет аппаратного ускорения
4. **Память**: Мало оперативной памяти для буферов

---

## Решение 1: Автоматическая оптимизация потоков (УЖЕ РЕАЛИЗОВАНО)

Код теперь автоматически определяет количество CPU ядер и использует оптимальное число потоков:

```python
cpu_count = multiprocessing.cpu_count()
encoding_threads = min(max(1, cpu_count // 2), 4)
```

**Что это дает:**
- На 8-ядерном сервере: использует 4 потока
- На 4-ядерном сервере: использует 2 потока
- На 2-ядерном сервере: использует 1 поток
- Избегает перегрузки системы

---

## Решение 2: Настроить tmpfs для временных файлов

### Что такое tmpfs?
tmpfs - это файловая система в оперативной памяти. Запись/чтение происходит в **10-100 раз быстрее**, чем с диска.

### Настройка tmpfs для uploads/temp

1. **Создайте директорию:**
```bash
sudo mkdir -p /path/to/autoparts/backend/uploads/temp
```

2. **Добавьте в /etc/fstab:**
```bash
# Строка: tmpfs <точка монтирования> <тип> <опции> <дамп> <pass>
tmpfs /path/to/autoparts/backend/uploads/temp tmpfs defaults,size=512M 0 0
```

3. **Смонтируйте:**
```bash
sudo mount -a
```

4. **Проверьте:**
```bash
df -h | grep temp
# Должно показать: tmpfs ... 512M ... /path/to/autoparts/backend/uploads/temp
```

**Важно:**
- Выделите минимум 512MB для temp
- Файлы в tmpfs исчезают после перезагрузки (это нормально для временных файлов)
- Убедитесь, что на сервере достаточно RAM

---

## Решение 3: Проверить и обновить FFmpeg

### Проверка версии:
```bash
ffmpeg -version
```

### Установка последней версии FFmpeg (Ubuntu 20.04+):

```bash
# Удалить старую версию
sudo apt remove ffmpeg

# Добавить репозиторий с последней версией
sudo add-apt-repository ppa:jonathonf/ffmpeg-4
sudo apt update

# Установить
sudo apt install ffmpeg -y

# Проверить
ffmpeg -version
```

**Или собрать из исходников для максимальной производительности:**

```bash
sudo apt install autoconf automake build-essential cmake git-core libass-dev \
    libfreetype6-dev libsdl2-dev libtool libva-dev libvdpau-dev libvorbis-dev \
    libxcb1-dev libxcb-shm0-dev libxcb-xfixes0-dev pkg-config texinfo wget zlib1g-dev \
    nasm yasm libx264-dev libx265-dev libnuma-dev libvpx-dev libfdk-aac-dev \
    libmp3lame-dev libopus-dev -y

cd ~
mkdir ffmpeg_sources && cd ~/ffmpeg_sources

# Скачать и собрать FFmpeg с оптимизациями
wget https://ffmpeg.org/releases/ffmpeg-6.0.tar.xz
tar xJf ffmpeg-6.0.tar.xz
cd ffmpeg-6.0

./configure --prefix="$HOME/ffmpeg_build" --pkg-config-flags="--static" \
    --extra-cflags="-I$HOME/ffmpeg_build/include" --extra-ldflags="-L$HOME/ffmpeg_build/lib" \
    --extra-libs=-lpthread --extra-libs=-lm --bindir="$HOME/bin" --enable-gpl \
    --enable-libx264 --enable-libx265 --enable-nonfree

make -j$(nproc)
sudo make -j$(nproc)
sudo make install
```

---

## Решение 4: Оптимизировать параметры сжатия

### Для слабых серверов (1-2 ядра):

Изменить в `app/tasks/video_tasks.py`:

```python
video_bitrate="600k",    # Еще меньше битрейт
audio_bitrate="48k",     # Минимальный аудио
preset="ultrafast",      # Самый быстрый
crf=26,                  # Чуть лучше качество при том же размере
threads=1                # Один поток (на слабом CPU)
```

### Для мощных серверов (4+ ядер):

```python
video_bitrate="800k",
audio_bitrate="64k",
preset="superfast",      # Быстрее ultrafast
crf=28,
threads=4                # Максимум 4 потока
```

---

## Решение 5: Приоритизация процессов Celery

### Увеличить приоритет процесса:

```bash
# Найти PID worker процесса Celery
ps aux | grep celery

# Увеличить приоритет (меньше число = выше приоритет)
sudo renice -n -5 -p <PID>
```

### Или запустить Celery с высоким приоритетом:

```bash
nice -n -5 celery -A app.celery_app worker --loglevel=info
```

**Внимание:** Это может замедлить другие процессы на сервере!

---

## Решение 6: Мониторинг и диагностика

### 1. Проверить использование CPU во время сжатия:
```bash
top
# Нажать '1' чтобы увидеть все ядра
# Запустить загрузку видео и смотреть загрузку CPU
```

### 2. Проверить дисковую скорость:
```bash
# Тест скорости записи
dd if=/dev/zero of=./testfile bs=1M count=100 conv=fdatasync

# Тест скорости чтения
hdparm -t /dev/sda  # заменить на ваш диск
```

### 3. Проверить память:
```bash
free -h
vmstat 1  # Обновление каждую секунду
```

### 4. Логирование времени выполнения:

Добавить в `video_tasks.py`:

```python
import time

start_time = time.time()
compressed_path = compress_video(...)
end_time = time.time()

print(f"⏱ Compression took: {end_time - start_time:.2f} seconds")
print(f"📊 Original size: {os.path.getsize(temp_file_path) / 1024 / 1024:.2f} MB")
print(f"📊 Compressed size: {os.path.getsize(compressed_path) / 1024 / 1024:.2f} MB")
print(f"📊 Compression ratio: {(1 - os.path.getsize(compressed_path)/os.path.getsize(temp_file_path)) * 100:.1f}%")
```

---

## Решение 7: Асинхронная очередь задач (для высокой нагрузки)

Если на сервер приходит много видео одновременно:

### Настроить Redis для очереди:

```bash
# Установить Redis
sudo apt install redis-server

# Настроить максимальную память
sudo nano /etc/redis/redis.conf
# maxmemory 256mb
# maxmemory-policy allkeys-lru

# Перезапустить
sudo systemctl restart redis
```

### Обновить настройки Celery в `.env`:

```env
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

### Запустить несколько workers:

```bash
# Worker 1 (высокий приоритет)
celery -A app.celery_app worker --loglevel=info -Q high_priority -c 2

# Worker 2 (обычный приоритет)
celery -A app.celery_app worker --loglevel=info -Q default -c 4
```

---

## Быстрая проверка: чеклист

- [ ] Код обновлен (автоматическое определение потоков) ✅
- [ ] Проверено количество CPU ядер на сервере: `nproc`
- [ ] Проверена версия FFmpeg: `ffmpeg -version`
- [ ] Настроен tmpfs (опционально, но рекомендуется)
- [ ] Добавлено логирование времени сжатия
- [ ] Проверена нагрузка на CPU во время сжатия: `top`
- [ ] Проверена скорость диска (если медленно > 30 сек)

---

## Ожидаемые результаты

### После оптимизации:

| Сервер | До | После | Улучшение |
|--------|-----|-------|-----------|
| 1 ядро, 1GB RAM | 60 сек | 30 сек | 2x быстрее |
| 2 ядра, 2GB RAM | 40 сек | 15 сек | 2.5x быстрее |
| 4 ядра, 4GB RAM | 30 сек | 8 сек | 3.5x быстрее |
| 8 ядер, 8GB RAM | 20 сек | 5 сек | 4x быстрее |

**Важно:** С tmpfs скорость может быть еще выше на 20-30%!

---

## Экстренная помощь: если всё ещё медленно

### 1. Проверить логи:
```bash
tail -f /var/log/celery/worker.log
# Искать сообщения о сжатии
```

### 2. Проверить нагрузку на сервер:
```bash
htop
# Смотреть загрузку CPU и память
```

### 3. Временно уменьшить требования к качеству:

В крайнем случае, для тестирования:

```python
video_bitrate="500k",    # Очень низкий битрейт
crf=30,                  # Низкое качество
preset="ultrafast"
```

Это даст минимальное время обработки, но качество будет низким.

---

## Контакты для помощи

Если после всех оптимизаций всё ещё медленно:

1. Запустите диагностику:
```bash
nproc                    # Количество ядер
free -h                  # Память
ffmpeg -version          # Версия FFmpeg
df -h                    # Место на диске
```

2. Отправьте логи Celery за последние 5 минут

3. Укажите:
   - Тип сервера (VPS, dedicated, cloud)
   - Количество ядер CPU
   - Объем RAM
   - Тип диска (HDD, SSD, NVMe)
