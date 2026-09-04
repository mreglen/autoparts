#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/test_setup_001 \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("\n".join(d.get("links") or [])); print("SUB", d.get("subscription_url"))'
echo ---
curl -s -o /dev/null -w 'site=%{http_code}\n' -H 'Host: svoygarage.ru' https://127.0.0.1/ -k
systemctl is-active nginx
ss -tulpn | grep -E ':(80|443|8443|62050|8080)\s' || true
