#!/bin/bash
set -euo pipefail
for i in $(seq 1 40); do
  if ! pgrep -f '/usr/local/bin/update' >/dev/null; then
    echo "UPDATE_DONE after ${i}0s-ish"
    break
  fi
  echo "waiting $i ..."
  sleep 20
done
tail -30 /var/log/autoparts-update.log
systemctl is-active kroan
curl -sS -o /dev/null -w 'api_vpn=%{http_code}\n' http://127.0.0.1:8080/api/admin/vpn/users || true
# 401/403 means route exists; 404 means missing
test -f /home/fast/autoparts/frontend/my-autoparts/src/pages/Admin/AdminVpnPage.jsx && echo PAGE_OK
grep -n "admin-vpn" /home/fast/autoparts/frontend/my-autoparts/src/pages/Profile/menu/profileMenuConfig.js | head
grep -o 'AdminVpnPage\|/admin/vpn' /var/www/my-autoparts/static/js/*.js 2>/dev/null | sort | uniq -c | head
cd /home/fast/autoparts && git log -1 --oneline
