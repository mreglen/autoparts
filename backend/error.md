# Ошибка обработки видео на сервере Ubuntu

## Дата ошибки
2026-03-10 15:24:02

## Описание проблемы
FFmpeg не может создать выходной файл при сжатии видео из-за отсутствия прав доступа.

## Лог ошибки
```
[out#0/mp4 @ 0x5e64e676f080] Error opening output uploads/videos/TVgpq7hgzd/TVgpq7hgzd_20260310_152301_205ea215.mp4: Permission denied
Error opening output file uploads/videos/TVgpq7hgzd/TVgpq7hgzd_20260310_152301_205ea215.mp4.
Error opening output files: Permission denied
```

## Причина
Процесс Celery worker, запущенный от пользователя `fast`, не имеет прав на запись в директорию `uploads/videos/TVgpq7hgzd/`.

## Диагностика

### 1. Проверить текущие права доступа:
```bash
cd /home/fast/autoparts/backend
ls -la uploads/
ls -la uploads/videos/
ls -la uploads/videos/TVgpq7hgzd/
```

### 2. Проверить владельца процесса Celery:
```bash
ps aux | grep celery
```

## Решение

### Способ 1: Изменить владельца директории (рекомендуется)
```bash
cd /home/fast/autoparts/backend
sudo chown -R fast:fast uploads/
sudo chmod -R 755 uploads/
```

### Способ 2: Если нужно дать полные права
```bash
sudo chmod -R 777 uploads/
```
⚠️ **Внимание**: Это менее безопасно, т.к. даёт права записи всем пользователям.

### Способ 3: Добавить пользователя в нужную группу
```bash
# Узнать текущую группу владельца
ls -ln uploads/videos/

# Добавить пользователя fast в эту группу
sudo usermod -a -G <группа> fast

# Перезайти в системе для применения изменений
```

## Проверка после исправления

```bash
# Убедиться что права применены
ls -la uploads/videos/

# Протестировать создание файла вручную
touch uploads/videos/test.txt
rm uploads/videos/test.txt

# Перезапустить Celery worker
celery -A app.celery_app worker --loglevel=info
```

## Полный скрипт для быстрого исправления

```bash
#!/bin/bash
cd /home/fast/autoparts/backend

echo "Проверка текущих прав..."
ls -la uploads/

echo "\nИзменение владельца на fast:fast..."
sudo chown -R fast:fast uploads/

echo "\nУстановка прав 755..."
sudo chmod -R 755 uploads/

echo "\nПроверка результата..."
ls -la uploads/

echo "\nГотово! Перезапустите Celery worker."
```

## Предотвращение проблемы в будущем

### 1. При создании новых папок организаций убедиться что они наследуют правильные права:
```bash
# Установить umask для создания файлов с правильными правами
umask 022
```

### 2. Настроить ACL для автоматического наследования прав:
```bash
sudo setfacl -R -m u:fast:rwx uploads/
sudo setfacl -R -d -m u:fast:rwx uploads/
```

### 3. Добавить проверку прав при запуске приложения:
```python
import os

def check_upload_permissions():
    upload_dir = 'uploads'
    if not os.access(upload_dir, os.W_OK):
        raise PermissionError(f"Нет прав на запись в {upload_dir}")
```

## Примечания

- Входной файл успешно читается (размер 51,293,790 байт)
- FFmpeg установлен корректно (версия 6.1.1-3ubuntu5)
- Проблема только с правами на запись в выходную директорию
- После исправления прав видео должно обрабатываться без ошибок

---

**Статус**: Ожидает исправления прав доступа на сервере
