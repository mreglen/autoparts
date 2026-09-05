#!/bin/bash
set -euo pipefail
ls -la /etc/nginx/sites-enabled/svoygarage
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users limit 1" | tr -d '[:space:]')
echo TOKEN=$TOKEN
curl -sSI -A Happ/3.0 "https://svoygarage.ru/sub/${TOKEN}" | head -25
echo '--- nginx snippet ---'
sed -n '28,70p' /etc/nginx/sites-enabled/svoygarage
