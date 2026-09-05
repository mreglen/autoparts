#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Reconnect node id=1
curl -s -X POST -H "Authorization: Bearer ${TOKEN}" \
  http://127.0.0.1:62050/api/node/1/reconnect || true
sleep 5
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool

# Check reachability to node service from master
timeout 5 bash -c 'echo >/dev/tcp/212.102.227.25/62050' && echo NODE_62050_OK || echo NODE_62050_FAIL
timeout 5 bash -c 'echo >/dev/tcp/212.102.227.25/62051' && echo NODE_62051_OK || echo NODE_62051_FAIL

sleep 8
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool

# Check 8443 on node via sshpass
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new root@212.102.227.25 \
  'ss -tulpn | grep -E ":(62050|62051|8443)\s" || true; docker logs marzban-node --tail=30'
