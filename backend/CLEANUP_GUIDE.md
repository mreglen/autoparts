# 🧹 Очистка Python мусора на Ubuntu

## 📋 Скрипты очистки

### 1. **Интерактивный скрипт** (с подтверждениями)

**Использование:**
```bash
cd /home/fast/autoparts/backend

# Делаем скрипт исполняемым
chmod +x cleanup_python.sh

# Запускаем с интерактивными подтверждениями
./cleanup_python.sh

# Или указываем конкретную директорию
./cleanup_python.sh /home/fast/autoparts
```

**Что делает:**
- ✅ Показывает размер файлов перед удалением
- ✅ Спрашивает подтверждение для каждого типа
- ✅ Очищает: `__pycache__/`, `*.pyc`, `*.pyo`, `*.pyd`, `*.egg-info/`, `.pytest_cache/`, `.tox/`
- ✅ Показывает итоговый результат

---

### 2. **Быстрый скрипт** (без вопросов)

**Использование:**
```bash
cd /home/fast/autoparts/backend

# Делаем скрипт исполняемым
chmod +x clean_quick.sh

# Быстрая очистка текущей директории
./clean_quick.sh

# Или указываем конкретную директорию
./clean_quick.sh /home/fast/autoparts
```

**Что делает:**
- ✅ Моментально удаляет весь мусор
- ✅ Не спрашивает подтверждения
- ✅ Показывает размер до и после
- ✅ Идеально для CI/CD

---

## 🔧 Ручная очистка (одной командой)

### Вариант 1: Полная очистка
```bash
cd /home/fast/autoparts

# Найти и удалить весь мусор
find . -type d -name "__pycache__" -exec rm -rf {} + ; \
find . -type f -name "*.pyc" -delete ; \
find . -type f -name "*.pyo" -delete ; \
find . -type d -name "*.egg-info" -exec rm -rf {} + ; \
find . -type d -name ".pytest_cache" -exec rm -rf {} + ; \
find . -type d -name ".tox" -exec rm -rf {} + ; \
find . -type f -name ".coverage" -delete

echo "✅ Очистка завершена!"
```

### Вариант 2: Только __pycache__
```bash
cd /home/fast/autoparts
find . -type d -name "__pycache__" -exec rm -rf {} +
echo "✅ __pycache__ очищен!"
```

### Вариант 3: Только .pyc файлы
```bash
cd /home/fast/autoparts
find . -type f -name "*.pyc" -delete
echo "✅ .pyc файлы удалены!"
```

---

## 📊 Проверка размера перед очисткой

```bash
# Посмотреть сколько места занимают __pycache__
du -sh /home/fast/autoparts/backend/__pycache__ 2>/dev/null

# Посмотреть размер всех __pycache__ в проекте
du -sch $(find /home/fast/autoparts -type d -name "__pycache__") 2>/dev/null | tail -1

# Посмотреть сколько места занимают .pyc файлы
du -sch $(find /home/fast/autoparts -type f -name "*.pyc") 2>/dev/null | tail -1
```

---

## 🎯 Автоматизация через cron (ежедневная очистка)

```bash
# Открываем crontab
crontab -e

# Добавляем задачу для ежедневной очистки в 3 часа ночи
0 3 * * * cd /home/fast/autoparts/backend && ./clean_quick.sh > /var/log/cleanup_python.log 2>&1

# Или раз в неделю по воскресеньям в 2 часа ночи
0 2 * * 0 cd /home/fast/autoparts/backend && ./cleanup_python.sh < /dev/null > /var/log/cleanup_python.log 2>&1
```

---

## 📝 Что удаляется

### ✅ Безопасно удалять:
- `__pycache__/` - Кэш байт-кода Python
- `*.pyc` - Скомпилированные Python файлы
- `*.pyo` - Оптимизированные Python файлы
- `*.pyd` - Python DLL (для Windows)
- `*.egg-info/` - Информация о пакетах
- `.eggs/` - Временные яйца пакетов
- `.pytest_cache/` - Кэш тестов pytest
- `.tox/` - Виртуальные окружения tox
- `.coverage` - Данные покрытия кода
- `htmlcov/` - HTML отчеты coverage

### ⚠️ НЕ удалять:
- `venv/` или `.venv/` - Виртуальные окружения (если нужны)
- `node_modules/` - JavaScript зависимости
- `.git/` - Git репозиторий
- `uploads/` - Пользовательские файлы
- `static/` - Статические файлы

---

## 💡 Советы

### 1. Добавьте в `.gitignore`:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
.pytest_cache/
.tox/
.coverage
htmlcov/
```

### 2. Проверяйте размер перед удалением:

```bash
# Всегда смотрите сколько места занимает мусор
du -sh __pycache__ *.pyc 2>/dev/null
```

### 3. Используйте быстрый скрипт в production:

```bash
# Быстро и без вопросов
./clean_quick.sh /path/to/project
```

### 4. Для глубокой очистки используйте интерактивный:

```bash
# С подтверждениями чтобы не удалить лишнее
./cleanup_python.sh
```

---

## 🔍 Мониторинг освобожденного места

```bash
# До очистки
SIZE_BEFORE=$(du -sh /home/fast/autoparts | cut -f1)
echo "До: $SIZE_BEFORE"

# Очистка
./clean_quick.sh

# После
SIZE_AFTER=$(du -sh /home/fast/autoparts | cut -f1)
echo "После: $SIZE_AFTER"

# Разница
echo "Освобождено: $((SIZE_BEFORE - SIZE_AFTER))"
```

---

## 🚀 Готово!

Теперь у вас есть мощные инструменты для очистки Python проекта от мусора! 

**Выберите подходящий вариант:**
- ✅ `cleanup_python.sh` - для интерактивной очистки с подтверждениями
- ✅ `clean_quick.sh` - для быстрой автоматической очистки
- ✅ Ручные команды - для точечного удаления

**Рекомендация:** Запустите быструю очистку перед деплоем! 🎯
