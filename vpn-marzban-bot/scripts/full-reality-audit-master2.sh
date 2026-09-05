#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
UUID=ccc7e71d-743a-499a-b5b7-f1a484368b7d
echo "========== MASTER AUDIT2 $(date -Is) =========="
echo "pbk=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)"
echo "sid=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)"

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
echo "token_ok=${#TOK}"

curl -sS -H "Authorization: Bearer $TOK" \
  "http://127.0.0.1:62050/api/user/tg_768651771_efbc54" -o /tmp/user.json
python3 - <<'PY'
import json
u=json.load(open('/tmp/user.json'))
print('status', u.get('status'))
print('expire', u.get('expire'))
print('used', u.get('used_traffic'), 'limit', u.get('data_limit'))
print('online', u.get('online_at'))
print('uuid', (u.get('proxies') or {}).get('vless',{}).get('id'))
print('flow', (u.get('proxies') or {}).get('vless',{}).get('flow'))
print('inbounds', u.get('inbounds'))
print('sub', u.get('subscription_url'))
for L in (u.get('links') or [])[:8]:
    print('LINK', L)
PY

curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config -o /tmp/core.json
python3 - <<'PY'
import json
c=json.load(open('/tmp/core.json'))
for ib in c.get('inbounds',[]):
    ss=ib.get('streamSettings') or {}
    rs=ss.get('realitySettings') or {}
    if not rs: continue
    clients=(ib.get('settings') or {}).get('clients') or []
    ids=[x.get('id') for x in clients]
    print(ib.get('tag'), 'port', ib.get('port'), 'clients', len(clients), 'has_uuid', 'ccc7e71d-743a-499a-b5b7-f1a484368b7d' in ids)
    print('  shortIds', rs.get('shortIds'))
    print('  serverNames', rs.get('serverNames'))
    print('  dest', rs.get('dest'))
    print('  privateKey', (rs.get('privateKey') or '')[:20]+'...')
PY

# Running config inside marzban container if present
cd /opt/marzban-vpn
echo "=== docker logs (reality/errors) ==="
docker compose logs --tail=200 marzban 2>&1 | grep -iE 'reality|rejected|invalid user|failed to process|certificate|handshak' | tail -50 || echo none

echo "=== nodes ==="
curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json; ns=json.load(sys.stdin);
print(type(ns), len(ns) if hasattr(ns,"__len__") else ns)
items=ns if isinstance(ns,list) else (ns.get("nodes") or [])
for n in items:
  print(n.get("name"), n.get("address"), n.get("status"), n.get("message"))'

echo "=== prove ping from master ==="
PBK=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
IMG=$(docker compose images -q marzban | head -1)
for pair in "RU:195.24.65.251:18093" "DE:212.102.227.25:18094"; do
  NAME=${pair%%:*}; REST=${pair#*:}; ADDR=${REST%%:*}; LOCAL=${REST##*:}
  CFG=/tmp/prove-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"www.apple.com","fingerprint":"chrome","publicKey":"$PBK","shortId":"$SID"}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 12 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE $NAME -> $CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
done
