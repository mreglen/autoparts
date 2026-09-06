#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
docker compose exec -T marzban ls -la /var/lib/marzban/certs/ || true
echo | timeout 5 openssl s_client -connect 127.0.0.1:8443 -servername svoygarage.ru 2>/dev/null | openssl x509 -noout -subject -dates 2>/dev/null || echo OPENSSL_FAIL
# check core security
curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 -c 'import sys,json;c=json.load(sys.stdin)
for ib in c["inbounds"]:
  if ib.get("port")==8443:
    ss=ib.get("streamSettings") or {}
    print("security", ss.get("security"))
    print("certs", (ss.get("tlsSettings") or {}).get("certificates"))'

prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"tls","tlsSettings":{"serverName":"svoygarage.ru","allowInsecure":false,"fingerprint":"chrome","alpn":["http/1.1"]}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU_IP 195.24.65.251 18721
prove RU_DOM svoygarage.ru 18722
prove DE 212.102.227.25 18723
