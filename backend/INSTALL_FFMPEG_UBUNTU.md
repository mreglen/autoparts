# Установка и настройка FFmpeg на Ubuntu Server

Это руководство описывает процесс установки, настройки и оптимизации FFmpeg на сервере под управлением Ubuntu Server.

## Оглавление

- [Требования](#требования)
- [Установка FFmpeg](#установка-ffmpeg)
- [Проверка установки](#проверка-установки)
- [Базовая настройка](#базовая-настройка)
- [Оптимизация для сервера](#оптимизация-для-сервера)
- [Примеры использования](#примеры-использования)
- [Интеграция с приложением](#интеграция-с-приложением)
- [Устранение неполадок](#устранение-неполадок)

---

## Требования

### Минимальные требования
- ОС: Ubuntu Server 20.04 LTS или выше
- ОЗУ: минимум 2 ГБ (рекомендуется 4+ ГБ для обработки видео)
- Место на диске: минимум 500 МБ для FFmpeg + место для временных файлов
- Процессор: рекомендуется многоядерный CPU для кодирования

### Дополнительные компоненты
```bash
# Обновление пакетов
sudo apt update
sudo apt upgrade -y

# Установка необходимых утилит
sudo apt install -y curl wget git software-properties-common
```

---

## Установка FFmpeg

### Способ 1: Установка из официальных репозиториев Ubuntu (рекомендуется)

```bash
# Установка FFmpeg из репозиториев Ubuntu
sudo apt install -y ffmpeg

# Проверка версии
ffmpeg -version
```

**Преимущества:**
- Стабильная версия
- Автоматические обновления безопасности
- Простота установки

**Недостатки:**
- Версия может быть не самой новой

### Способ 2: Установка последней версии из PPA (для новых функций)

```bash
# Добавление PPA с последней версией FFmpeg
sudo add-apt-repository ppa:savoury1/ffmpeg4
sudo add-apt-repository ppa:savoury1/multimedia

# Обновление списка пакетов
sudo apt update

# Установка FFmpeg
sudo apt install -y ffmpeg

# Проверка версии
ffmpeg -version
```

### Способ 3: Сборка из исходного кода (для максимальной производительности)

```bash
# Установка зависимостей для сборки
sudo apt install -y build-essential yasm cmake libtool libc6 \
libc6-dev pkg-config libssl-dev libx264-dev libx265-dev \
libnuma-dev libvpx-dev libfdk-aac-dev libmp3lame-dev \
libopus-dev libvorbis-dev libwebp-dev libtheora-dev \
libfreetype6-dev libfontconfig1-dev zlib1g-dev libass-dev \
libbluray-dev libgsm1-dev libsoxr-dev libssh-gcrypt-dev \
libzmq5-dev librav1e-dev libaom-dev libsvtav1-dev

# Создание директории для загрузки исходников
mkdir -p ~/ffmpeg_sources && cd ~/ffmpeg_sources

# Загрузка последних версий библиотек

# AMQP (для RTMP)
git clone --depth 1 https://github.com/FFmpeg/nv-codec-headers.git
cd nv-codec-headers
sudo make install
cd ..

# X264
git clone --depth 1 https://code.videolan.org/videolan/x264.git
cd x264
./configure --prefix="$HOME/ffmpeg_build" --enable-static
make -j$(nproc)
sudo make install
cd ..

# X265
git clone --depth 1 https://bitbucket.org/multicoreware/x265_git.git
cd x265_git/build/linux
cmake -G "Unix Makefiles" -DCMAKE_INSTALL_PREFIX="$HOME/ffmpeg_build" \
-DENABLE_SHARED=off ../../source
make -j$(nproc)
sudo make install
cd ../../../..

# Libvpx
git clone --depth 1 --branch main https://chromium.googlesource.com/webm/libvpx.git
cd libvpx
./configure --prefix="$HOME/ffmpeg_build" --disable-examples \
--disable-unit-tests --enable-vp9-highbitdepth --as=yasm
make -j$(nproc)
sudo make install
cd ..

# FFmpeg
git clone --depth 1 https://github.com/FFmpeg/FFmpeg.git
cd FFmpeg
PATH="$HOME/bin:$PATH" PKG_CONFIG_PATH="$HOME/ffmpeg_build/lib/pkgconfig" ./configure \
--prefix="$HOME/ffmpeg_build" \
--pkg-config-flags="--static" \
--extra-cflags="-I$HOME/ffmpeg_build/include" \
--extra-ldflags="-L$HOME/ffmpeg_build/lib" \
--extra-libs=-lpthread \
--extra-libs=-lm \
--bindir="$HOME/bin" \
--enable-gpl \
--enable-gnutls \
--enable-libx264 \
--enable-libx265 \
--enable-libvpx \
--enable-libmp3lame\
--enable-libopus \
--enable-libvorbis \
--enable-libtheora \
--enable-libvpx \
--enable-libwebp \
--enable-libass \
--enable-libfreetype \
--enable-fontconfig \
--enable-nonfree \
--enable-openssl \
--enable-libfdk_aac \
--enable-libsvtav1 \
--enable-libaom \
--enable-librav1e \
--enable-vaapi \
--enable-vdpau \
--enable-libdrm \
--enable-libxcb \
--enable-filter="drawtext"

make -j$(nproc)
sudo make install
cd ..

# Добавление в PATH
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Проверка установки
ffmpeg -version
```

---

## Проверка установки

### Базовая проверка

```bash
# Проверка версии и конфигурации
ffmpeg -version

# Просмотр доступных кодеков
ffmpeg -codecs

# Просмотр доступных декодеров
ffmpeg -decoders

# Просмотр доступных энкодеров
ffmpeg -encoders

# Просмотр доступных форматов
ffmpeg -formats

# Просмотр доступных фильтров
ffmpeg -filters
```

### Тестирование функциональности

```bash
# Тестовое кодирование короткого фрагмента
ffmpeg -i input.mp4 -t 5 -c:v libx264 -preset fast -crf 23 output.mp4

# Проверка поддержки аппаратного ускорения
vainfo  # для Intel
nvidia-smi  # для NVIDIA
```

---

## Базовая настройка

### Настройка переменных окружения

Создайте файл `/etc/profile.d/ffmpeg.sh`:

```bash
sudo nano /etc/profile.d/ffmpeg.sh
```

Добавьте содержимое:

```bash
export FFMPEG_HOME=/usr/bin
export FFMPEG_DATA=/usr/share/ffmpeg
export LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH
```

Примените изменения:

```bash
source /etc/profile.d/ffmpeg.sh
```

### Оптимизация системных ресурсов

#### Настройка лимитов для пользователя

Отредактируйте `/etc/security/limits.conf`:

```bash
sudo nano /etc/security/limits.conf
```

Добавьте строки:

```
# Оптимизация для FFmpeg
www-data soft nofile 65536
www-data hard nofile 65536
www-data soft nproc 4096
www-data hard nproc 4096
root soft nofile 65536
root hard nofile 65536
```

#### Настройка ядра для лучшей производительности

Создайте файл `/etc/sysctl.d/99-ffmpeg-optimization.conf`:

```bash
sudo nano /etc/sysctl.d/99-ffmpeg-optimization.conf
```

Добавьте параметры:

```conf
# Увеличение максимального количества открытых файлов
fs.file-max = 2097152

# Оптимизация работы с памятью
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5

# Сетевая оптимизация
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 65536 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
```

Примените настройки:

```bash
sudo sysctl --system
```

---

## Оптимизация для сервера

### 1. Использование всех ядер процессора

FFmpeg автоматически использует многопоточность. Для ручного управления:

```bash
# Установка количества потоков
ffmpeg -threads 4 -i input.mp4 -c:v libx264 -threads 4 output.mp4

# Автоматическое определение оптимального количества потоков
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 output.mp4
```

### 2. Аппаратное ускорение

#### Intel Quick Sync (QSV)

```bash
# Проверка поддержки
ls -l /dev/dri/

# Кодирование с использованием QSV
ffmpeg -hwaccel qsv -c:v h264_qsv -i input.mp4 \
-c:v h264_qsv -preset speed output.mp4
```

#### NVIDIA NVENC

```bash
# Установка драйверов NVIDIA
sudo apt install -y nvidia-driver-525 nvidia-cuda-toolkit

# Проверка работы
nvidia-smi

# Кодирование с использованием NVENC
ffmpeg -cuda -c:v h264_cuvid -i input.mp4 \
-c:v h264_nvenc -preset fast output.mp4
```

#### AMD VCE/VCN

```bash
# Кодирование с использованием AMD
ffmpeg -hwaccel vaapi -vaapi_device /dev/dri/renderD128 \
-c:v h264_vaapi -i input.mp4 -c:v h264_vaapi output.mp4
```

### 3. Оптимизация для конвертации большого количества файлов

Создайте скрипт для пакетной обработки `/usr/local/bin/batch-convert.sh`:

```bash
#!/bin/bash

# Конфигурация
INPUT_DIR="/var/videos/input"
OUTPUT_DIR="/var/videos/output"
TEMP_DIR="/var/videos/temp"
LOG_FILE="/var/log/ffmpeg/batch-convert.log"
MAX_CONCURRENT=4

# Создание директорий
mkdir -p "$OUTPUT_DIR" "$TEMP_DIR" "$(dirname $LOG_FILE)"

# Функция конвертации
convert_video() {
    local input_file="$1"
    local filename=$(basename "$input_file")
    local output_file="$OUTPUT_DIR/${filename%.*}_converted.mp4"
    
    echo "Начало обработки: $filename" >> "$LOG_FILE"
    
    ffmpeg -y -i "$input_file" \
        -c:v libx264 \
        -preset medium \
        -crf 23 \
        -c:a aac -b:a 128k \
        -movflags +faststart \
        "$output_file" 2>> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        echo "Завершено: $filename" >> "$LOG_FILE"
    else
        echo "Ошибка: $filename" >> "$LOG_FILE"
    fi
}

export -f convert_video
export LOG_FILE OUTPUT_DIR

# Поиск и обработка файлов
find "$INPUT_DIR" -type f \( -name "*.mp4" -o -name "*.avi" -o -name "*.mkv" -o -name "*.mov" \) | \
    parallel --max-procs $MAX_CONCURRENT convert_video {}

echo "Пакетная конвертация завершена" >> "$LOG_FILE"
```

Сделайте его исполняемым:

```bash
sudo chmod +x /usr/local/bin/batch-convert.sh
```

### 4. Мониторинг ресурсов

Установите утилиты для мониторинга:

```bash
sudo apt install -y htop iotop nethogs
```

Мониторинг использования ресурсов:

```bash
# Мониторинг процессов FFmpeg
htop -p $(pgrep -d',' ffmpeg)

# Мониторинг дискового I/O
iotop -oP -p $(pgrep -d',' ffmpeg)

# Мониторинг сетевого трафика
nethogs $(pgrep ffmpeg)
```

---

## Примеры использования

### 1. Конвертация видео с оптимальными настройками

```bash
# Базовая конвертация с хорошим балансом качество/размер
ffmpeg -i input.mp4 \
    -c:v libx264 \
    -preset slow \
    -crf 22 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    output.mp4
```

### 2. Изменение размера видео

```bash
# Масштабирование до 720p с сохранением пропорций
ffmpeg -i input.mp4 \
    -vf "scale=-1:720" \
    -c:v libx264 -preset medium -crf 23 \
    -c:a aac -b:a 128k \
    output_720p.mp4

# Масштабирование до 480p для мобильных устройств
ffmpeg -i input.mp4 \
    -vf "scale=-1:480" \
    -c:v libx264 -preset fast -crf 25 \
    -c:a aac -b:a 96k \
    output_480p.mp4
```

### 3. Извлечение аудио из видео

```bash
# Извлечение аудио в MP3
ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 audio.mp3

# Извлечение аудио в AAC
ffmpeg -i input.mp4 -vn -acodec aac -b:a 192k audio.aac

# Извлечение аудио в OGG
ffmpeg -i input.mp4 -vn -acodec libvorbis -q:a 5 audio.ogg
```

### 4. Создание скриншотов из видео

```bash
# Скриншот на 10-й секунде
ffmpeg -i input.mp4 -ss 00:00:10 -vframes 1 screenshot.jpg

# Создание серии скриншотов каждые 5 секунд
ffmpeg -i input.mp4 -vf "fps=1/5" screenshot_%03d.jpg

# Создание миниатюры (thumbnail)
ffmpeg -i input.mp4 -vf "scale=320:-1" thumbnail.jpg
```

### 5. Наложение водяного знака

```bash
# Наложение логотипа в правый верхний угол
ffmpeg -i input.mp4 -i logo.png \
    -filter_complex "overlay=W-w-10:H-h-10" \
    -c:a copy \
    output_with_watermark.mp4

# Полупрозрачный водяной знак
ffmpeg -i input.mp4 -i logo.png \
    -filter_complex "logo[wm];[wm][0:v]overlay=10:10:format=auto:enable='between(t,0,30)'" \
    -c:a copy \
    output_watermark.mp4
```

### 6. Объединение видео

Создайте файл `list.txt`:

```
file 'video1.mp4'
file 'video2.mp4'
file 'video3.mp4'
```

Объедините файлы:

```bash
ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4
```

### 7. Обрезка видео

```bash
# Обрезка по времени (с 10 по 30 секунду)
ffmpeg -i input.mp4 -ss 00:00:10 -to 00:00:30 -c copy trimmed.mp4

# Обрезка кадра (кроп)
ffmpeg -i input.mp4 -vf "crop=1280:720:0:0" -c:a copy cropped.mp4
```

### 8. Создание GIF из видео

```bash
# Создание GIF с оптимизацией
ffmpeg -i input.mp4 -vf "fps=10,scale=640:-1:flags=lanczos" \
    -c:v gif output.gif

# GIF с ограниченной палитрой для меньшего размера
ffmpeg -i input.mp4 -vf "fps=10,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
    output_optimized.gif
```

### 9. Транскодирование для веба

```bash
# Создание нескольких версий для адаптивного стриминга
# 1080p
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 20 \
    -c:a aac -b:a 192k -vf "scale=-1:1080" output_1080p.mp4

# 720p
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 22 \
    -c:a aac -b:a 128k -vf "scale=-1:720" output_720p.mp4

# 480p
ffmpeg -i input.mp4 -c:v libx264 -preset fast -crf 24 \
    -c:a aac -b:a 96k -vf "scale=-1:480" output_480p.mp4
```

---

## Интеграция с приложением

### Пример использования в Python (Celery)

Создайте задачу для фоновой обработки видео:

```python
# backend/app/tasks/video_tasks.py
import subprocess
import os
from celery import Celery

app = Celery('video_tasks')

def compress_video(input_path: str, output_path: str):
    """
    Сжатие видео с оптимизацией для веба
    """
    cmd = [
        'ffmpeg',
        '-y',  # Перезаписать выходной файл если существует
        '-i', input_path,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-threads', '4',
        output_path
    ]
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,  # Таймаут 1 час
            check=True
        )
        return True, result.stderr
    except subprocess.CalledProcessError as e:
        return False, f"Ошибка FFmpeg: {e.stderr}"
    except subprocess.TimeoutExpired:
        return False, "Превышено время выполнения"
    except Exception as e:
        return False, f"Неизвестная ошибка: {str(e)}"

@app.task(bind=True, max_retries=3)
def process_video_task(self, video_id: str, input_path: str, output_path: str):
    """
    Celery задача для обработки видео
    """
    try:
        success, message = compress_video(input_path, output_path)
        
        if success:
            # Логирование успешного выполнения
            print(f"Видео {video_id} успешно обработано")
            return {'status': 'success', 'video_id': video_id}
        else:
            # Повторная попытка при ошибке
            raise self.retry(exc=Exception(message), countdown=60)
            
    except Exception as exc:
        # Обработка критических ошибок
        print(f"Критическая ошибка при обработке {video_id}: {exc}")
        raise self.retry(exc=exc, countdown=300)
```

### Пример использования в Node.js

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function convertVideo(inputPath, outputPath, options = {}) {
    const {
        preset = 'medium',
        crf = 23,
        audioBitrate = '128k',
        threads = 4
    } = options;

    const command = `ffmpeg -y -i "${inputPath}" ` +
        `-c:v libx264 -preset ${preset} -crf ${crf} ` +
        `-c:a aac -b:a ${audioBitrate} ` +
        `-movflags +faststart ` +
        `-threads ${threads} "${outputPath}"`;

    try {
        const { stdout, stderr } = await execPromise(command);
        console.log('Конвертация завершена успешно');
        return { success: true, stderr };
    } catch (error) {
        console.error('Ошибка при конвертации:', error);
        return { success: false, error: error.message };
    }
}

// Использование
convertVideo('/path/to/input.mp4', '/path/to/output.mp4', {
    preset: 'slow',
    crf: 22,
    threads: 8
}).then(result => {
    if (result.success) {
        console.log('Готово!');
    } else {
        console.error('Не удалось конвертировать');
    }
});
```

---

## Устранение неполадок

### Распространенные ошибки

#### 1. Ошибка: "Permission denied"

**Решение:**
```bash
# Проверка прав доступа
ls -la /путь/к/файлу

# Назначение правильных прав
sudo chown www-data:www-data /var/videos
sudo chmod 755 /var/videos
```

#### 2. Ошибка: "No space left on device"

**Решение:**
```bash
# Проверка свободного места
df -h

# Очистка временных файлов
sudo rm -rf /tmp/*
sudo journalctl --vacuum-time=1d

# Увеличение раздела (если возможно)
sudo lvextend -l +100%FREE /dev/mapper/ubuntu-vg-root
sudo resize2fs /dev/mapper/ubuntu-vg-root
```

#### 3. Ошибка: "Codec not found"

**Решение:**
```bash
# Проверка доступных кодеков
ffmpeg -codecs | grep libx264

# Переустановка FFmpeg с необходимыми кодеками
sudo apt install --reinstall ffmpeg
```

#### 4. Ошибка: "Out of memory"

**Решение:**
```bash
# Уменьшение использования памяти через параметры
ffmpeg -i input.mp4 -c:v libx264 -threads 2 -preset ultrafast output.mp4

# Добавление swap файла
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

#### 5. Ошибка: "Invalid argument" или "Invalid data format"

**Решение:**
```bash
# Проверка целостности входного файла
ffprobe -v error -show_format -show_streams input.mp4

# Попытка восстановления поврежденного файла
ffmpeg -err_detect ignore_err -i input.mp4 -c copy recovered.mp4
```

### Логи и диагностика

#### Включение подробного логирования

```bash
# Детальный вывод FFmpeg
ffmpeg -loglevel verbose -i input.mp4 output.mp4

# Отладочный режим
ffmpeg -loglevel debug -i input.mp4 output.mp4 2>&1 | tee ffmpeg_debug.log
```

#### Мониторинг в реальном времени

```bash
# Просмотр прогресса кодирования
ffmpeg -i input.mp4 -c:v libx264 output.mp4 -progress pipe:1

# Использование ffprobe для анализа
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

### Полезные команды для диагностики

```bash
# Проверка загруженности CPU
top -p $(pgrep -d',' ffmpeg)

# Проверка использования памяти
ps -o pid,rss,command -p $(pgrep -d',' ffmpeg)

# Проверка дискового I/O
iostat -x 1

# Проверка температуры CPU (важно при длительном кодировании)
watch -n 1 'cat /sys/class/thermal/thermal_zone*/temp'
```

---

## Дополнительные ресурсы

### Официальная документация
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [FFmpeg Wiki](https://trac.ffmpeg.org/wiki)
- [Libx264 Settings](https://trac.ffmpeg.org/wiki/Encode/H.264)

### Сообщество и поддержка
- [FFmpeg Bug Tracker](https://trac.ffmpeg.org/)
- [Stack Overflow - FFmpeg Tag](https://stackoverflow.com/questions/tagged/ffmpeg)
- [Reddit - r/ffmpeg](https://www.reddit.com/r/ffmpeg/)

### Рекомендуемые утилиты
```bash
# Установка дополнительных инструментов
sudo apt install -y mediainfo handbrake-cli mkvtoolnix
```

---

## Заключение

FFmpeg — это мощный инструмент для обработки видео, который при правильной настройке может эффективно работать на Ubuntu Server. Следуйте этим рекомендациям:

1. **Выберите подходящий способ установки** в зависимости от ваших потребностей
2. **Настройте систему** для оптимальной производительности
3. **Используйте аппаратное ускорение** если доступно
4. **Мониторьте ресурсы** во время обработки
5. **Автоматизируйте процессы** с помощью скриптов и задач Celery

При возникновении проблем обращайтесь к логам и используйте инструменты диагностики.
