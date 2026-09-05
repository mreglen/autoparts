#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/hosts | python3 -m json.tool
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/user/test_setup_001 \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print("LINKS", len(d.get("links") or []));
[print(i+1, l[:90], "...") for i,l in enumerate(d.get("links") or [])]; print("SUB", d.get("subscription_url"))'
grep -E 'UVICORN|XRAY_SUB' /opt/marzban-vpn/.env || true
ss -tulpn | grep ':62050' || true
