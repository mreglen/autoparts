#!/bin/bash
set -euo pipefail
cp /tmp/happ_crypto.py /opt/marzban-vpn-bot/happ_crypto.py
cp /tmp/sub_proxy.py /opt/marzban-vpn-bot/sub_proxy.py
systemctl restart marzban-sub-proxy
sleep 1
systemctl is-active marzban-sub-proxy
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sSI -A 'Happ/3' "https://svoygarage.ru/sub/$TOKEN" | tr -d '\r' | grep -iE 'HTTP/|support|announce|profile'
echo '--- body ---'
curl -sS -A 'Happ/3' "https://svoygarage.ru/sub/$TOKEN" | python3 -c 'import sys,base64;t=sys.stdin.read().strip();
try:d=base64.b64decode(t).decode()
except Exception:d=t
print(d)'
