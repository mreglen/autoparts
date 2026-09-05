#!/bin/bash
set -euo pipefail
echo "==> Restart node container"
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new root@212.102.227.25 \
  'cd /opt/marzban-node && docker compose restart; sleep 3; docker compose logs --tail=20; ss -tulpn | grep -E ":(62050|8443)\s" || true'

PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s -X POST -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/1/reconnect
sleep 8
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool

# Full links
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/tgfixf557fe \
  | python3 -c 'import sys,json; d=json.load(sys.stdin);
links=d.get("links") or [];
print("n", len(links));
[print(l) for l in links];
print("sub", (d.get("subscription_url") or "").replace(":62050",":2086"))'

sshpass -p 'vNGrzXaKqX96DrMb' ssh root@212.102.227.25 'ss -tulpn | grep 8443 || true'
echo DONE
