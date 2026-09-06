#!/bin/bash
set -euo pipefail
PASS=$(grep -E '^SUDO_PASSWORD=' /opt/marzban-vpn/.env | cut -d= -f2- | tr -d '"' | tr -d "'")
cd /opt/marzban-vpn
PBK=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
echo "pbk=$PBK"
echo "sid=$SID"
TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
USER_JSON=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54)
python3 -c "import json,sys; u=json.load(sys.stdin); print('status',u.get('status'),'used',u.get('used_traffic'),'online',u.get('online_at')); print('uuid',u['proxies']['vless']['id']); print('sub',u.get('subscription_url'))" <<<"$USER_JSON"
UUID=$(python3 -c "import json,sys; print(json.load(sys.stdin)['proxies']['vless']['id'])" <<<"$USER_JSON")
BODY=$(curl -sS -m 20 -A 'Happ/3' "https://svoygarage.ru/sub/dGdfNzY4NjUxNzcxX2VmYmM1NCwxNzg4NjM2ODIwckWvWD3Wn5")
echo "=== sub ==="
python3 -c "import sys,base64; t=sys.stdin.read().strip();
try: d=base64.b64decode(t).decode()
except Exception: d=t
print(d)" <<<"$BODY"
IMG=$(docker compose images -q marzban | head -1)
prove() {
  local NAME=$1 ADDR=$2 PORT=$3 LOCAL=$4
  local CFG=/tmp/prove-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":$PORT,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"www.apple.com","fingerprint":"chrome","publicKey":"$PBK","shortId":"$SID"}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE $NAME $ADDR:$PORT -> HTTP $CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU 195.24.65.251 8443 18081
prove DE 212.102.227.25 8443 18082
