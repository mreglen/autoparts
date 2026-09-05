#!/bin/bash
set -euo pipefail
ls -la /root/.ssh/ 2>/dev/null || echo 'no /root/.ssh'
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/test_setup_001 \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("\n".join(d.get("links") or [])); print("---"); print("SUB", d.get("subscription_url"))'
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool
# Stage node package for easy scp once credentials available
mkdir -p /root/marzban-node-bundle
cp -a /home/fast/autoparts/vpn-marzban-bot/node/. /root/marzban-node-bundle/
cp /root/marzban-node-client.pem /root/marzban-node-bundle/ssl_client_cert.pem
ls -la /root/marzban-node-bundle/
echo BUNDLE_READY
