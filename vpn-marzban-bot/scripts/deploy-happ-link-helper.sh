#!/bin/bash
set -euo pipefail
cd /home/fast/autoparts
sudo -u fast git pull --ff-only origin celery_update
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  /home/fast/autoparts/vpn-marzban-bot/bot/ /opt/marzban-vpn-bot/
chown -R marzbanbot:marzbanbot /opt/marzban-vpn-bot
systemctl restart marzban-vpn-bot marzban-vpn-bot-celery marzban-vpn-bot-celerybeat
sleep 2
systemctl is-active marzban-vpn-bot marzban-vpn-bot-celery
cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
from happ_crypto import generate_valid_happ_link, is_real_happ_crypto_link
link = generate_valid_happ_link("http://195.24.65.251:2086/sub/test")
print(link[:60])
print("real=", is_real_happ_crypto_link(link))
assert is_real_happ_crypto_link(link)
print("OK")
PY
