# Установка FFmpeg для обработки видео

## Проблема
Для работы с видео (сжатие, определение длительности) требуется системная утилита FFmpeg.

## Решение 1: Автоматическая установка (рекомендуется)

Запустите скрипт установки:
```powershell
cd c:\Users\khram\Desktop\ilya\autoparts\backend
powershell -ExecutionPolicy Bypass -File install_ffmpeg.ps1
```

Скрипт:
1. Скачает FFmpeg
2. Распакует в `%LOCALAPPDATA%\ffmpeg`
3. Добавит в PATH
4. Проверит установку

**После установки перезапустите терминал!**

## Решение 2: Ручная установка

### Шаг 1: Скачать FFmpeg
Перейдите на сайт: https://www.gyan.dev/ffmpeg/builds/
Или прямая ссылка: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip

### Шаг 2: Распаковать
Распакуйте архив в удобную папку, например:
`C:\ffmpeg`

### Шаг 3: Добавить в PATH
1. Откройте "Свойства системы" → "Дополнительно" → "Переменные среды"
2. В "Системные переменные" найдите `Path`
3. Добавьте путь к папке `bin`, например: `C:\ffmpeg\bin`
4. Сохраните

### Шаг 4: Проверить
Откройте новый терминал и выполните:
```bash
ffprobe -version
ffmpeg -version
```

## Решение 3: Использовать без установки в PATH

Если вы установили FFmpeg в другую папку, укажите пути в файле `.env`:

```
FFPROBE_PATH=C:\path\to\ffprobe.exe
FFMPEG_PATH=C:\path\to\ffmpeg.exe
```

Или используйте абсолютные пути в коде:

Укажите полный путь к ffprobe в коде:
```python
# В app/utils/video_utils.py
FFPROBE_PATH = r"C:\ffmpeg\bin\ffprobe.exe"
FFMPEG_PATH = r"C:\ffmpeg\bin\ffmpeg.exe"

# Используйте эти пути в subprocess.run()
```

## После установки

1. Перезапустите Celery worker:
```bash
celery -A app.celery_app worker --loglevel=info --pool=solo
```

2. Попробуйте загрузить видео снова

## Проверка работы

После установки FFmpeg попробуйте загрузить видео через интерфейс приложения.
Видео должно:
- Определить длительность
- Сжаться до нужного размера
- Сохраниться в `/videos/{organization_id}/`
