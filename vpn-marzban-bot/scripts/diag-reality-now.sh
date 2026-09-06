#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
PUB=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
PRIV=$(tr -d '\r\n' </root/marzban-vpn-reality-private.key)
echo "PUB=$PUB"
echo "SID=$SID"
echo "PRIV_len=${#PRIV}"

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config -o /tmp/core.json
python3 - <<'PY'
import json
c=json.load(open('/tmp/core.json'))
for ib in c.get('inbounds') or []:
    if ib.get('port')!=8443: continue
    ss=ib.get('streamSettings') or {}
    rs=ss.get('realitySettings') or {}
    print('security', ss.get('security'))
    print('dest', rs.get('dest'))
    print('serverNames', rs.get('serverNames'))
    print('shortIds', rs.get('shortIds'))
    print('privateKey_prefix', (rs.get('privateKey') or '')[:16])
PY

curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 -o /tmp/user.json
python3 - <<'PY'
import json
u=json.load(open('/tmp/user.json'))
print('status', u.get('status'), 'proxies', u.get('proxies'))
for L in u.get('links') or []:
    print('LINK', L[:200])
PY
UUID=$(python3 -c 'import json;print(json.load(open("/tmp/user.json"))["proxies"]["vless"]["id"])')

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "SUB_TOKEN=$TOKEN"
BODY=$(curl -sS -A Happ/3 "https://svoygarage.ru/sub/$TOKEN")
python3 - <<PY
import base64,sys
t='''$BODY'''.strip()
try:d=base64.b64decode(t).decode()
except Exception:d=t
print(d)
assert 'security=reality' in d
print('sub_pbk_ok', '$PUB' in d)
print('sub_sid_ok', '$SID' in d)
PY

# Compare private keys file vs core
python3 - <<PY
import json
c=json.load(open('/tmp/core.json'))
priv_file=open('/root/marzban-vpn-reality-private.key').read().strip()
for ib in c.get('inbounds') or []:
    rs=(ib.get('streamSettings') or {}).get('realitySettings') or {}
    if not rs: continue
    print('priv_match', rs.get('privateKey')==priv_file)
PY

cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
SNI=dl.google.com
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-now-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"$SNI","fingerprint":"chrome","publicKey":"$PUB","shortId":"$SID"}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker logs "$CID" 2>&1 | tail -5 || true
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU 195.24.65.251 18501
prove DE 212.102.227.25 18502

# Check dest reachability
curl -sS -m 5 -o /dev/null -w 'dest_https=%{http_code}\n' https://dl.google.com/ || true
nc -zvw3 127.0.0.1 8443 2>&1 | tail -1
ss -lntp | grep 8443 || true

# recent errors
docker compose logs --tail=100 marzban 2>&1 | grep -iE 'reality|rejected|failed|certificate|invalid' | tail -30 || echo no_errors
