#!/usr/bin/env bash
set -euo pipefail
echo "==> Germany node status from master Marzban"
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes \
  | python3 -c 'import sys,json; ns=json.load(sys.stdin);
print(ns if not isinstance(ns,list) else [(n.get("name"),n.get("status"),n.get("address")) for n in ns])'

echo "==> Germany ports / node health via SSH"
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 root@212.102.227.25 'bash -s' <<'REMOTE'
set -e
echo hostname=$(hostname)
docker ps --format '{{.Names}} {{.Status}}' | head
ss -tulpn | grep -E '8443|62050|62051' || true
# Node does NOT serve /sub/ — only VLESS. Confirm no accidental nginx HTML on 443 for /sub
if command -v nginx >/dev/null; then
  echo "nginx present on node (unexpected for clean node):"
  ss -tulpn | grep -E ':80|:443' || true
else
  echo "no nginx on node (OK — subscriptions are on master only)"
fi
REMOTE

echo "==> Final GET content-type from public HTTPS"
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]')
curl -sS -D - -o /tmp/final_sub.bin -A "Happ/3.0" "https://svoygarage.ru/sub/${TOKEN}" | tr -d '\r' | head -15
python3 - <<'PY'
from pathlib import Path
import base64
b=Path('/tmp/final_sub.bin').read_bytes()
assert not b.lower().startswith(b'<!doctype') and b'<html' not in b[:200].lower()
text=b.decode()
dec=base64.b64decode(text.strip())
assert b'vless://' in dec
print('FINAL_OK bytes', len(b), 'vless_lines', dec.decode().count('vless://'))
PY
