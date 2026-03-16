#!/bin/bash

# 🚀 AutoParts Celery Setup Script for Linux (Ubuntu/Debian)
# Автоматическая настройка Celery worker для обработки видео

set -e  # Выход при ошибке

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_NC='\033[0m' # No Color

echo -e "${COLOR_GREEN}==================================${COLOR_NC}"
echo -e "${COLOR_GREEN}AutoParts Celery Setup Script${COLOR_NC}"
echo -e "${COLOR_GREEN}==================================${COLOR_NC}"
echo ""

# Проверка запуска от root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${COLOR_RED}❌ Пожалуйста, запустите от root (sudo ./setup-celery.sh)${COLOR_NC}"
    exit 1
fi

# 1. Проверка и установка FFmpeg
echo -e "${COLOR_YELLOW}[1/6] Проверка FFmpeg...${COLOR_NC}"
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${COLOR_YELLOW}⚠️  FFmpeg не найден. Установка...${COLOR_NC}"
    apt update
    apt install -y ffmpeg
else
    echo -e "${COLOR_GREEN}✅ FFmpeg уже установлен${COLOR_NC}"
    ffmpeg -version | head -n1
fi

# 2. Проверка Redis
echo -e ""
echo -e "${COLOR_YELLOW}[2/6] Проверка Redis...${COLOR_NC}"
if ! systemctl is-active --quiet redis-server; then
    echo -e "${COLOR_YELLOW}⚠️  Redis не активен. Установка и запуск...${COLOR_NC}"
    apt install -y redis-server
    systemctl enable redis-server
    systemctl start redis-server
else
    echo -e "${COLOR_GREEN}✅ Redis активен${COLOR_NC}"
fi

# 3. Проверка и создание Python virtual environment
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo -e "${COLOR_YELLOW}⚠️  Virtual environment not found. Creating...${COLOR_NC}"
    python3 -m venv venv
    echo -e "${COLOR_GREEN}✅ Virtual environment created${COLOR_NC}"
else
    echo -e "${COLOR_GREEN}✅ Virtual environment exists${COLOR_NC}"
fi

# Определение пути к pip в venv
if [ -d "venv" ]; then
    VENV_PIP="$(pwd)/venv/bin/pip"
elif [ -d ".venv" ]; then
    VENV_PIP="$(pwd)/.venv/bin/pip"
else
    echo -e "${COLOR_RED}❌ Virtual environment not found!${COLOR_NC}"
    exit 1
fi

# 4. Установка Python зависимостей в venv
echo -e ""
echo -e "${COLOR_YELLOW}[4/7] Установка Python зависимостей...${COLOR_NC}"
$VENV_PIP install --upgrade pip
$VENV_PIP install -r requirements.txt
echo -e "${COLOR_GREEN}✅ Зависимости установлены${COLOR_NC}"

# 4. Создание пользователя www-data если не существует
echo -e ""
echo -e "${COLOR_YELLOW}[5/7] Проверка пользователя www-data...${COLOR_NC}"
if ! id -u www-data > /dev/null 2>&1; then
    echo -e "${COLOR_YELLOW}⚠️  Пользователь www-data не найден. Создание...${COLOR_NC}"
    useradd -r -s /bin/false www-data
else
    echo -e "${COLOR_GREEN}✅ Пользователь www-data существует${COLOR_NC}"
fi

# 5. Настройка прав доступа
echo -e ""
echo -e "${COLOR_YELLOW}[6/7] Настройка прав доступа...${COLOR_NC}"
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
chown -R www-data:www-data "$BACKEND_DIR"
chmod -R 755 "$BACKEND_DIR"
chmod 777 "$BACKEND_DIR/uploads"
echo -e "${COLOR_GREEN}✅ Права настроены${COLOR_NC}"

# 6. Установка systemd службы
echo -e ""
echo -e "${COLOR_YELLOW}[7/7] Установка systemd службы...${COLOR_NC}"

# Получение абсолютного пути к backend директории
ABS_BACKEND_DIR=$(realpath "$BACKEND_DIR")

# Определение пути к Python в venv
if [ -d "venv/bin" ]; then
    PYTHON_BIN="$ABS_BACKEND_DIR/venv/bin/python"
    CELERY_BIN="$ABS_BACKEND_DIR/venv/bin/celery"
elif [ -d ".venv/bin" ]; then
    PYTHON_BIN="$ABS_BACKEND_DIR/.venv/bin/python"
    CELERY_BIN="$ABS_BACKEND_DIR/.venv/bin/celery"
else
    echo -e "${COLOR_RED}❌ Virtual environment not found!${COLOR_NC}"
    exit 1
fi

echo -e "${COLOR_YELLOW}Backend directory: $ABS_BACKEND_DIR${COLOR_NC}"
echo -e "${COLOR_YELLOW}Python binary: $PYTHON_BIN${COLOR_NC}"
echo -e "${COLOR_YELLOW}Celery binary: $CELERY_BIN${COLOR_NC}"

# Определение количества CPU ядер
CPU_CORES=$(nproc)
if [ "$CPU_CORES" -gt 4 ]; then
    CONCURRENCY=4
else
    CONCURRENCY=$CPU_CORES
fi

echo -e "${COLOR_YELLOW}CPU cores: $CPU_CORES, Concurrency: $CONCURRENCY${COLOR_NC}"

# Создание systemd файла
cat > /etc/systemd/system/celery.service << EOF
[Unit]
Description=Celery Worker Service for AutoParts
After=network.target redis.service postgresql.service

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=$ABS_BACKEND_DIR
Environment="PATH=$ABS_BACKEND_DIR/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
EnvironmentFile=$ABS_BACKEND_DIR/.env
ExecStart=$CELERY_BIN -A app.celery_app worker \\
    --loglevel=INFO \\
    --concurrency=$CONCURRENCY \\
    --pool=prefork \\
    --max-tasks-per-child=100 \\
    --worker-send-task-events \\
    --detach

Restart=always
RestartSec=5s
LimitNOFILE=65535
Nice=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=celery-worker

[Install]
WantedBy=multi-user.target
EOF

echo -e "${COLOR_GREEN}✅ Systemd служба создана${COLOR_NC}"

# Перезагрузка systemd и запуск службы
echo -e ""
echo -e "${COLOR_YELLOW}🔄 Перезагрузка systemd...${COLOR_NC}"
systemctl daemon-reload

echo -e ""
echo -e "${COLOR_YELLOW}🚀 Запуск Celery службы...${COLOR_NC}"
systemctl enable celery
systemctl start celery

# Проверка статуса
echo -e ""
echo -e "${COLOR_YELLOW}📊 Статус службы:${COLOR_NC}"
sleep 2
systemctl status celery --no-pager

# Тестовая информация
echo -e ""
echo -e "${COLOR_GREEN}==================================${COLOR_NC}"
echo -e "${COLOR_GREEN}✅ Настройка завершена успешно!${COLOR_NC}"
echo -e "${COLOR_GREEN}==================================${COLOR_NC}"
echo -e ""
echo -e "${COLOR_YELLOW}📝 Полезные команды:${COLOR_NC}"
echo -e "  Проверка статуса:     ${COLOR_GREEN}sudo systemctl status celery${COLOR_NC}"
echo -e "  Перезапуск:           ${COLOR_GREEN}sudo systemctl restart celery${COLOR_NC}"
echo -e "  Остановка:            ${COLOR_GREEN}sudo systemctl stop celery${COLOR_NC}"
echo -e "  Просмотр логов:       ${COLOR_GREEN}sudo journalctl -u celery -f${COLOR_NC}"
echo -e ""
echo -e "${COLOR_YELLOW}🔍 Мониторинг Celery:${COLOR_NC}"
echo -e "  Активные задачи:      ${COLOR_GREEN}celery -A app.celery_app inspect active${COLOR_NC}"
echo -e "  Статистика:           ${COLOR_GREEN}celery -A app.celery_app inspect stats${COLOR_NC}"
echo -e ""
echo -e "${COLOR_YELLOW}⚡ Тестирование скорости:${COLOR_NC}"
echo -e "  Загрузите видео через API и проверьте время обработки в логах"
echo -e ""
echo -e "${COLOR_GREEN}Готово! Celery теперь оптимизирован для быстрой обработки видео.${COLOR_NC}"
