#!/bin/bash
set -euo pipefail

SRC=/home/fast/autoparts/vpn-marzban-bot/bot
BOT_DIR=/opt/marzban-vpn-bot

id -u marzbanbot >/dev/null 2>&1 || useradd --system --home "$BOT_DIR" --shell /usr/sbin/nologin marzbanbot

mkdir -p "$BOT_DIR"
cp "$SRC/main.py" "$BOT_DIR/"
cp "$SRC/requirements.txt" "$BOT_DIR/"

MARZ_PASS=$(cat /root/marzban-vpn-admin.pass)

if [[ ! -f "$BOT_DIR/.env" ]]; then
  cat > "$BOT_DIR/.env" <<EOF
BOT_TOKEN=REPLACE_WITH_TELEGRAM_BOT_TOKEN
MARZBAN_BASE_URL=http://127.0.0.1:62050
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=${MARZ_PASS}
INBOUND_TAG=VLESS TCP REALITY
DATA_LIMIT_GB=50
EXPIRE_DAYS=30
COOLDOWN_SECONDS=60
EOF
else
  # keep BOT_TOKEN, refresh marzban password
  sed -i "s|^MARZBAN_PASSWORD=.*|MARZBAN_PASSWORD=${MARZ_PASS}|" "$BOT_DIR/.env"
fi
chmod 600 "$BOT_DIR/.env"

apt-get install -y python3-venv python3-pip >/dev/null
python3 -m venv "$BOT_DIR/.venv"
"$BOT_DIR/.venv/bin/pip" install --upgrade pip >/dev/null
"$BOT_DIR/.venv/bin/pip" install -r "$BOT_DIR/requirements.txt"

chown -R marzbanbot:marzbanbot "$BOT_DIR"

cp "$SRC/marzban-vpn-bot.service" /etc/systemd/system/marzban-vpn-bot.service
systemctl daemon-reload

TOKEN_VAL=$(grep '^BOT_TOKEN=' "$BOT_DIR/.env" | cut -d= -f2-)
if [[ "$TOKEN_VAL" == "REPLACE_WITH_TELEGRAM_BOT_TOKEN" || -z "$TOKEN_VAL" ]]; then
  systemctl disable marzban-vpn-bot.service 2>/dev/null || true
  systemctl stop marzban-vpn-bot.service 2>/dev/null || true
  echo "BOT_PENDING_TOKEN=1"
  echo "Put BOT_TOKEN into $BOT_DIR/.env then: systemctl enable --now marzban-vpn-bot"
else
  systemctl enable --now marzban-vpn-bot.service
  systemctl --no-pager status marzban-vpn-bot.service || true
  echo "BOT_STARTED=1"
fi
