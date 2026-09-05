#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer ${TOK}" http://127.0.0.1:62050/api/nodes | python3 -c '
import sys, json
d = json.load(sys.stdin)
ns = d if isinstance(d, list) else d.get("nodes") or d.get("data") or []
if isinstance(ns, dict):
    ns = list(ns.values())
for n in ns:
    print(n.get("name"), n.get("status"), n.get("address") or n.get("ip"))
'
