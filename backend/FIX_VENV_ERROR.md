# 🛠 Fix: Externally Managed Environment Error

## ❌ Проблема

При запуске `setup-celery.sh` возникает ошибка:

```
error: externally-managed-environment

× This environment is externally managed
╰─> To install Python packages system-wide, try apt install python3-xyz
```

**Причина:** Ubuntu 24.04 (и другие современные дистрибутивы) запрещают установку Python пакетов системно без использования virtual environment.

---

## ✅ Решение

### Вариант 1: Использовать обновленный скрипт (РЕКОМЕНДУЕТСЯ)

Скрипт был обновлен для автоматического создания и использования virtual environment.

**Запустите заново:**

```bash
cd backend
chmod +x setup-celery.sh
sudo ./setup-celery.sh
```

**Что изменилось:**
- Скрипт теперь автоматически создает `venv` если его нет
- Устанавливает все зависимости в virtual environment
- Использует правильный путь к `venv/bin/python` и `venv/bin/pip`

---

### Вариант 2: Создать venv вручную перед запуском

Если хотите контролировать процесс:

```bash
# Перейдите в директорию backend
cd backend

# Создайте virtual environment
python3 -m venv venv

# Активируйте его
source venv/bin/activate

# Обновите pip
pip install --upgrade pip

# Установите зависимости
pip install -r requirements.txt

# Выйдите из venv
deactivate

# Запустите скрипт настройки
sudo ./setup-celery.sh
```

---

### Вариант 3: Использовать setup-celery-highperf.sh

Альтернативный скрипт с высокой производительностью:

```bash
cd backend
chmod +x setup-celery-highperf.sh
sudo ./setup-celery-highperf.sh
```

Этот скрипт также автоматически создает venv.

---

## 🔍 Проверка успешной установки

После запуска скрипта проверьте:

```bash
# 1. Проверьте, что venv создан
ls -la venv/bin/python

# 2. Проверьте установленные пакеты
venv/bin/pip list | grep celery

# 3. Проверьте Celery
venv/bin/celery --version

# 4. Проверьте статус службы
sudo systemctl status celery
```

---

## ⚙️ Что делает скрипт теперь

### Старая версия (НЕ РАБОТАЕТ):

```bash
❌ pip3 install -r requirements.txt  # Пытается установить системно
```

### Новая версия (РАБОТАЕТ):

```bash
✅ python3 -m venv venv              # Создает venv
✅ venv/bin/pip install -r requirements.txt  # Устанавливает в venv
✅ venv/bin/celery ...               # Использует celery из venv
```

---

## 🎯 Правильный порядок действий

```bash
# 1. Перейдите в backend
cd ~/autoparts/backend

# 2. Запустите обновленный скрипт
sudo ./setup-celery.sh

# ИЛИ для high performance версии:
sudo ./setup-celery-highperf.sh

# 3. Проверьте статус
sudo systemctl status celery

# 4. Протестируйте загрузку видео
```

---

## 📚 Дополнительная информация

### Почему Ubuntu запрещает системную установку?

PEP 668 защищает системные пакеты Python от конфликтов:
- Системные утилиты Ubuntu используют Python
- Установка новых версий пакетов может сломать систему
- Virtual environment изолирует ваши проекты

### Где хранится venv?

```
~/autoparts/backend/venv/
├── bin/
│   ├── python      # Python интерпретатор
│   ├── pip         # Менеджер пакетов
│   └── celery      # Celery CLI
├── lib/
│   └── python3.12/site-packages/  # Установленные пакеты
└── ...
```

### Как активировать venv вручную?

```bash
cd ~/autoparts/backend
source venv/bin/activate

# Теперь используете Python и пакеты из venv
python --version
pip list
celery --version

# Деактивировать
deactivate
```

---

## ✅ Чек-лист

- [ ] Скрипт обновлен (`git pull` или скопирован заново)
- [ ] `venv` создан в директории `backend`
- [ ] Зависимости установлены через `venv/bin/pip`
- [ ] Celery работает (`celery --version`)
- [ ] Служба запущена (`systemctl status celery`)

---

## 🎉 Готово!

Теперь скрипт должен работать без ошибок!

**Ожидаемый результат:**
```
✅ FFmpeg уже установлен
✅ Redis активен
✅ Virtual environment created
✅ Dependencies installed
✅ Permissions set
✅ Systemd service created
✅ Celery started
```

**Проверьте:** `sudo systemctl status celery` должен показывать `active (running)` 🚀
