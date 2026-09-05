#!/usr/bin/env bash
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

echo "=== nodes ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -m json.tool | head -80

echo "=== hosts ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/hosts | python3 -c '
import sys,json
d=json.load(sys.stdin)
for t,es in d.items():
  for e in es:
    print(e)
'

echo "=== core inbound ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 -c '
import sys,json
cfg=json.load(sys.stdin)
for ib in cfg.get("inbounds") or []:
  print("tag", ib.get("tag"), "port", ib.get("port"), "proto", ib.get("protocol"))
  ss=ib.get("streamSettings") or {}
  print("network", ss.get("network"), "security", ss.get("security"))
  r=ss.get("realitySettings") or {}
  print({k:r.get(k) for k in ("dest","serverNames","shortIds","publicKey","fingerprint","spiderX","show")})
'

echo "=== sample user links (raw marzban) ==="
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users where telegram_id=768651771" | tr -d "[:space:]")
curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" | python3 -c '
import sys,json
u=json.load(sys.stdin)
print("status", u.get("status"), "expire", u.get("expire"))
for L in u.get("links") or []:
  print(L)
print("SUB", u.get("subscription_url"))
'

echo "=== disk xray ==="
python3 - <<'PY'
import json
p='/var/lib/marzban-vpn/xray_config.json'
cfg=json.load(open(p))
for ib in cfg.get('inbounds') or []:
  print('disk tag', ib.get('tag'), 'port', ib.get('port'))
  r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
  print('disk', {k:r.get(k) for k in ('dest','serverNames','shortIds','privateKey','fingerprint','spiderX')})
PY

echo "=== public key from private ==="
PRIV=$(python3 -c 'import json;r=json.load(open("/var/lib/marzban-vpn/xray_config.json"))["inbounds"][0]["streamSettings"]["realitySettings"];print(r.get("privateKey",""))')
docker exec marzban-vpn xray x25519 -i "$PRIV" 2>/dev/null || docker run --rm --entrypoint xray gozargah/marzban:latest x25519 -i "$PRIV" 2>/dev/null || true

echo "=== listen / ufw ==="
ss -tulpn | grep 8443 || true
ufw status | grep 8443 || true

echo "=== tls probe to apple via openssl from master ==="
timeout 5 bash -c 'echo | openssl s_client -connect www.apple.com:443 -servername www.apple.com 2>/dev/null | head -5' || echo openssl_fail

echo "=== recent xray/marzban logs ==="
docker logs marzban-vpn --tail 40 2>&1 | tail -40
