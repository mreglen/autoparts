#!/usr/bin/env bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c '
import sys,json
u=json.load(sys.stdin)
print("status", u.get("status"))
print("expire", u.get("expire"))
print("used", u.get("used_traffic"), "limit", u.get("data_limit"))
print("online", u.get("online_at"))
print("sub", u.get("subscription_url"))
'
# external port reachability from DE to RU via node
sshpass -p "$(cat /root/de-node.pass 2>/dev/null || true)" true 2>/dev/null || true
echo "=== from master to both 8443 ==="
nc -zvw3 195.24.65.251 8443 2>&1 | tail -1
nc -zvw3 212.102.227.25 8443 2>&1 | tail -1
