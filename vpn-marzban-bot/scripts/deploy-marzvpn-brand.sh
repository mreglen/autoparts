#!/bin/bash
set -euo pipefail
cp /tmp/sub_proxy.py /opt/marzban-vpn-bot/sub_proxy.py
cp /tmp/handlers.py /opt/marzban-vpn-bot/handlers.py
cp /tmp/happ_crypto.py /opt/marzban-vpn-bot/happ_crypto.py
systemctl restart marzban-sub-proxy marzban-vpn-bot
sleep 1
systemctl is-active marzban-sub-proxy marzban-vpn-bot
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
curl -sSI -A 'Happ/3' "https://svoygarage.ru/sub/$TOKEN" | tr -d '\r' | grep -iE 'HTTP/|profile-title|content-disposition'
