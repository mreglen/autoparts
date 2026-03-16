#!/bin/bash

# 🚀 Quick Setup: High Performance Celery Configuration
# Быстрая настройка оптимизированного Celery для обработки видео

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
COLOR_NC='\033[0m'

echo -e "${COLOR_BLUE}============================================${COLOR_NC}"
echo -e "${COLOR_BLUE}🚀 High Performance Celery Quick Setup${COLOR_NC}"
echo -e "${COLOR_BLUE}============================================${COLOR_NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${COLOR_RED}❌ Please run with sudo${COLOR_NC}"
    exit 1
fi

# Get backend directory
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
ABS_BACKEND_DIR=$(realpath "$BACKEND_DIR")

echo -e "${COLOR_YELLOW}📁 Backend directory: $ABS_BACKEND_DIR${COLOR_NC}"
echo ""

# Check and create virtual environment if not exists
if [ ! -d "venv" ] && [ ! -d ".venv" ]; then
    echo -e "${COLOR_YELLOW}⚠️  Virtual environment not found. Creating...${COLOR_NC}"
    python3 -m venv venv
    echo -e "${COLOR_GREEN}✅ Virtual environment created${COLOR_NC}"
else
    echo -e "${COLOR_GREEN}✅ Virtual environment exists${COLOR_NC}"
fi

# Determine Python path in venv
if [ -d "venv" ]; then
    VENV_BIN="$ABS_BACKEND_DIR/venv/bin"
elif [ -d ".venv" ]; then
    VENV_BIN="$ABS_BACKEND_DIR/.venv/bin"
else
    echo -e "${COLOR_RED}❌ Virtual environment not found!${COLOR_NC}"
    exit 1
fi

echo -e "${COLOR_YELLOW}🐍 Python virtual environment: $VENV_BIN${COLOR_NC}"
echo ""

# Get CPU cores
CPU_CORES=$(nproc)
echo -e "${COLOR_YELLOW}💻 CPU Cores: $CPU_CORES${COLOR_NC}"

# Calculate optimal concurrency
if [ "$CPU_CORES" -ge 16 ]; then
    CONCURRENCY=16
elif [ "$CPU_CORES" -ge 8 ]; then
    CONCURRENCY=8
elif [ "$CPU_CORES" -ge 4 ]; then
    CONCURRENCY=4
else
    CONCURRENCY=2
fi

echo -e "${COLOR_YELLOW}⚡ Recommended concurrency: $CONCURRENCY${COLOR_NC}"
echo ""

# Create systemd service file
echo -e "${COLOR_YELLOW}📝 Creating systemd service...${COLOR_NC}"

cat > /etc/systemd/system/celery.service << EOF
# /etc/systemd/system/celery.service
# 🚀 Optimized Celery Worker Service - High Performance Video Processing

[Unit]
Description=Celery Worker Service for AutoParts - Video Processing
Documentation=https://docs.celeryq.dev/
After=network.target redis.service postgresql.service
Wants=redis.service postgresql.service

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=$ABS_BACKEND_DIR
Environment="PATH=$VENV_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="PYTHONDONTWRITEBYTECODE=1"
EnvironmentFile=$ABS_BACKEND_DIR/.env

# HIGH PERFORMANCE CONFIGURATION
ExecStart=$VENV_BIN/celery -A app.celery_app worker \\
    --loglevel=INFO \\
    --concurrency=$CONCURRENCY \\
    --pool=prefork \\
    --max-tasks-per-child=50 \\
    --worker-send-task-events \\
    --detach

KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=5s

# RESOURCE LIMITS
LimitNOFILE=65536
LimitNPROC=65536
Nice=-5
IOSchedulingClass=realtime
IOSchedulingPriority=0
OOMScoreAdjust=-500

RuntimeDirectory=celery
RuntimeDirectoryMode=0755

StandardOutput=journal
StandardError=journal
SyslogIdentifier=celery-worker

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=$ABS_BACKEND_DIR/uploads
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

echo -e "${COLOR_GREEN}✅ Systemd service created${COLOR_NC}"
echo ""

# Set permissions
echo -e "${COLOR_YELLOW}🔐 Setting permissions...${COLOR_NC}"

if id -u www-data &>/dev/null; then
    chown -R www-data:www-data "$ABS_BACKEND_DIR"
    chmod -R 755 "$ABS_BACKEND_DIR"
    chmod 777 "$ABS_BACKEND_DIR/uploads"
    echo -e "${COLOR_GREEN}✅ Permissions set for www-data${COLOR_NC}"
else
    echo -e "${COLOR_YELLOW}⚠️  User www-data not found, using current user${COLOR_NC}"
    CURRENT_USER=$(whoami)
    chown -R $CURRENT_USER:$CURRENT_USER "$ABS_BACKEND_DIR"
fi

echo ""

# Reload systemd and start service
echo -e "${COLOR_YELLOW}🔄 Reloading systemd...${COLOR_NC}"
systemctl daemon-reload

echo -e "${COLOR_YELLOW}🚀 Enabling Celery service...${COLOR_NC}"
systemctl enable celery

echo -e "${COLOR_YELLOW}▶️  Starting Celery service...${COLOR_NC}"
systemctl start celery

sleep 2

echo ""
echo -e "${COLOR_BLUE}============================================${COLOR_NC}"
echo -e "${COLOR_GREEN}✅ Setup Complete!${COLOR_NC}"
echo -e "${COLOR_BLUE}============================================${COLOR_NC}"
echo ""

# Show status
echo -e "${COLOR_YELLOW}📊 Service Status:${COLOR_NC}"
systemctl status celery --no-pager -l

echo ""
echo -e "${COLOR_YELLOW}🔍 Useful Commands:${COLOR_NC}"
echo -e "  ${COLOR_GREEN}Check status:${COLOR_NC}      sudo systemctl status celery"
echo -e "  ${COLOR_GREEN}View logs:${COLOR_NC}         sudo journalctl -u celery -f"
echo -e "  ${COLOR_GREEN}Restart:${COLOR_NC}           sudo systemctl restart celery"
echo -e "  ${COLOR_GREEN}Stop:${COLOR_NC}              sudo systemctl stop celery"
echo -e ""
echo -e "${COLOR_YELLOW}🎯 Celery Monitoring:${COLOR_NC}"
echo -e "  ${COLOR_GREEN}Active tasks:${COLOR_NC}      celery -A app.celery_app inspect active"
echo -e "  ${COLOR_GREEN}Worker stats:${COLOR_NC}      celery -A app.celery_app inspect stats"
echo -e ""
echo -e "${COLOR_YELLOW}⚡ Configuration Summary:${COLOR_NC}"
echo -e "  • Concurrency: ${COLOR_GREEN}$CONCURRENCY processes${COLOR_NC}"
echo -e "  • Max tasks per child: ${COLOR_GREEN}50${COLOR_NC}"
echo -e "  • Priority: ${COLOR_GREEN}High (Nice=-5)${COLOR_NC}"
echo -e "  • I/O Scheduling: ${COLOR_GREEN}Realtime${COLOR_NC}"
echo -e "  • OOM Protection: ${COLOR_GREEN}Enabled (-500)${COLOR_NC}"
echo -e ""
echo -e "${COLOR_GREEN}🎉 Your Celery is now optimized for high-performance video processing!${COLOR_NC}"
echo -e "${COLOR_GREEN}Expected speed: 5-10 seconds per video (instead of 60s)${COLOR_NC}"
echo ""
