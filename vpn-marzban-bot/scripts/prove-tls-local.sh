#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
CFG=/tmp/prove-local.json
cat >"$CFG" <<JSON
{"log":{"loglevel":"debug"},"inbounds":[{"port":18731,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"127.0.0.1","port":8443,"users":[{"id":"$UUID","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"tls","tlsSettings":{"serverName":"svoygarage.ru","allowInsecure":false,"fingerprint":"chrome","alpn":["http/1.1"]}}}]}
JSON
CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
sleep 2
CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:18731" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
echo "PROVE_LOCAL=$CODE"
docker logs "$CID" 2>&1 | tail -20
docker stop "$CID" >/dev/null 2>&1 || true
# xray access on master
docker compose logs --tail=50 marzban 2>&1 | grep -iE '8443|tls|reject|fail|accept' | tail -20 || true
# restart marzban core
docker compose restart marzban
sleep 8
CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
sleep 2
CODE=$(curl -sS -m 15 -x "socks5h://127.0.0.1:18731" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
echo "PROVE_LOCAL_AFTER_RESTART=$CODE"
docker stop "$CID" >/dev/null 2>&1 || true
