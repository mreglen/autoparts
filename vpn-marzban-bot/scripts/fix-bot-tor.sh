#!/bin/bash
set -euo pipefail
cd /home/fast/autoparts
sudo -u fast git fetch origin
sudo -u fast git pull --ff-only origin celery_update

# Sync apply helper + sudoers + bot code (same as ensure_vpn_bot_apply)
SRC=vpn-marzban-bot/scripts/marzban-vpn-bot-apply.sh
install -m 755 "$SRC" /usr/local/bin/marzban-vpn-bot-apply
sed -i 's/\r$//' /usr/local/bin/marzban-vpn-bot-apply

BOT_DIR=/opt/marzban-vpn-bot
install -m 644 vpn-marzban-bot/bot/main.py "$BOT_DIR/main.py"
install -m 644 vpn-marzban-bot/bot/requirements.txt "$BOT_DIR/requirements.txt"
install -m 644 vpn-marzban-bot/bot/marzban-vpn-bot.service /etc/systemd/system/marzban-vpn-bot.service
sed -i 's/\r$//' "$BOT_DIR/main.py" "$BOT_DIR/requirements.txt" /etc/systemd/system/marzban-vpn-bot.service

# Ensure Tor proxy in .env
if ! grep -q '^TELEGRAM_PROXY_URL=' "$BOT_DIR/.env"; then
  printf '\nTELEGRAM_PROXY_URL=socks5://127.0.0.1:9050\n' >> "$BOT_DIR/.env"
else
  # force correct default if empty
  python3 - <<'PY'
from pathlib import Path
p = Path("/opt/marzban-vpn-bot/.env")
lines = p.read_text().splitlines()
out = []
found = False
for line in lines:
    if line.startswith("TELEGRAM_PROXY_URL="):
        found = True
        val = line.split("=",1)[1].strip()
        if not val:
            out.append("TELEGRAM_PROXY_URL=socks5://127.0.0.1:9050")
        else:
            out.append(line)
    else:
        out.append(line)
if not found:
    out.append("TELEGRAM_PROXY_URL=socks5://127.0.0.1:9050")
p.write_text("\n".join(out)+"\n")
PY
fi

"$BOT_DIR/.venv/bin/pip" install -q -r "$BOT_DIR/requirements.txt"
chown -R marzbanbot:marzbanbot "$BOT_DIR"
systemctl daemon-reload
systemctl enable --now tor.service || true
systemctl restart marzban-vpn-bot.service
sleep 3
systemctl --no-pager -l status marzban-vpn-bot.service | head -25
echo '--- logs ---'
journalctl -u marzban-vpn-bot -n 30 --no-pager
echo '--- env proxy ---'
grep TELEGRAM_PROXY_URL "$BOT_DIR/.env"
