#!/bin/bash
set -euo pipefail
SRC=/home/fast/autoparts/vpn-marzban-bot/scripts/marzban-vpn-bot-apply.sh
BIN=/usr/local/bin/marzban-vpn-bot-apply
DST=/etc/sudoers.d/autoparts-vpn-bot

install -m 755 "$SRC" "$BIN"
sed -i 's/\r$//' "$BIN"

tmp="$(mktemp)"
cat >"$tmp" <<'EOF'
# Managed by /usr/local/bin/update — allow API (user fast) to apply VPN bot token from /admin-settings
fast ALL=(root) NOPASSWD: /usr/local/bin/marzban-vpn-bot-apply
EOF
install -m 440 "$tmp" "$DST"
visudo -cf "$DST"
rm -f "$tmp"

# Ensure bot unit exists
if [[ -f /home/fast/autoparts/vpn-marzban-bot/bot/marzban-vpn-bot.service ]]; then
  cp /home/fast/autoparts/vpn-marzban-bot/bot/marzban-vpn-bot.service /etc/systemd/system/marzban-vpn-bot.service
  systemctl daemon-reload
fi

# Ensure bot dir/user from earlier setup
id -u marzbanbot >/dev/null 2>&1 || useradd --system --home /opt/marzban-vpn-bot --shell /usr/sbin/nologin marzbanbot
mkdir -p /opt/marzban-vpn-bot
if [[ ! -f /opt/marzban-vpn-bot/main.py ]]; then
  cp /home/fast/autoparts/vpn-marzban-bot/bot/main.py /opt/marzban-vpn-bot/
  cp /home/fast/autoparts/vpn-marzban-bot/bot/requirements.txt /opt/marzban-vpn-bot/
fi
if [[ ! -d /opt/marzban-vpn-bot/.venv ]]; then
  python3 -m venv /opt/marzban-vpn-bot/.venv
  /opt/marzban-vpn-bot/.venv/bin/pip install -r /opt/marzban-vpn-bot/requirements.txt
fi
if [[ ! -f /opt/marzban-vpn-bot/.env ]]; then
  MARZ_PASS=$(cat /root/marzban-vpn-admin.pass 2>/dev/null || echo 'CHANGE_ME')
  cat > /opt/marzban-vpn-bot/.env <<EOF
BOT_TOKEN=REPLACE_WITH_TELEGRAM_BOT_TOKEN
MARZBAN_BASE_URL=http://127.0.0.1:62050
MARZBAN_USERNAME=admin
MARZBAN_PASSWORD=${MARZ_PASS}
INBOUND_TAG=VLESS TCP REALITY
DATA_LIMIT_GB=50
EXPIRE_DAYS=30
COOLDOWN_SECONDS=60
EOF
  chmod 600 /opt/marzban-vpn-bot/.env
fi
chown -R marzbanbot:marzbanbot /opt/marzban-vpn-bot

echo "OK apply=$(ls -la $BIN)"
sudo -u fast sudo -n /usr/local/bin/marzban-vpn-bot-apply status
echo "DONE"
