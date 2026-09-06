#!/usr/bin/env bash
set -euo pipefail
TOKEN='dGdfNzY4NjUxNzcxX2VmYmM1NCwxNzg4NjM2ODIwckWvWD3Wn5'
PUB=$(tr -d '[:space:]' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '[:space:]' </root/marzban-vpn-reality-shortid.txt)
PRIV=$(tr -d '[:space:]' </root/marzban-vpn-reality-private.key)
echo "SERVER_PUB=$PUB"
echo "SERVER_SID=$SID"

echo "=== /sub body ==="
curl -sS -D /tmp/h.hdr -o /tmp/h.bin -A 'Happ/3.5.0' "https://svoygarage.ru/sub/${TOKEN}"
grep -iE 'HTTP/|content-type|profile-update' /tmp/h.hdr | head
python3 - <<PY
import base64, urllib.parse
raw=open('/tmp/h.bin','rb').read()
dec=base64.b64decode(raw).decode()
print(dec)
pub=open('/root/marzban-vpn-reality-public.key').read().strip()
sid=open('/root/marzban-vpn-reality-shortid.txt').read().strip()
for i,l in enumerate(dec.splitlines()):
  q=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(l).query))
  print(f'L{i} host={l.split("@")[1].split("?")[0]} pbk_ok={q.get("pbk")==pub} sid_ok={q.get("sid")==sid} flow={q.get("flow")} sni={q.get("sni")} fp={q.get("fp")}')
  assert q.get('pbk')==pub, (q.get('pbk'), pub)
  assert q.get('sid')==sid, (q.get('sid'), sid)
print('LINK_KEYS_OK')
PY

# Prove RU public IP
UUID=$(python3 -c 'import base64,re;d=base64.b64decode(open("/tmp/h.bin","rb").read()).decode().splitlines()[0];print(re.match(r"vless://([^@]+)@",d).group(1))')
python3 - <<PY
import json
cfg={
 "log":{"loglevel":"warning"},
 "inbounds":[{"listen":"127.0.0.1","port":18080,"protocol":"http"}],
 "outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"195.24.65.251","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},
 "streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"www.apple.com","fingerprint":"chrome","publicKey":"$PUB","shortId":"$SID","spiderX":"/"}}}]
}
json.dump(cfg, open('/tmp/xray-ru.json','w'))
cfg['outbounds'][0]['settings']['vnext'][0]['address']='212.102.227.25'
json.dump(cfg, open('/tmp/xray-de.json','w'))
print('uuid', '$UUID')
PY

prove() {
  local name=$1 cfg=$2
  docker rm -f xray-test-client >/dev/null 2>&1 || true
  docker run -d --name xray-test-client --network host -v "$cfg:/etc/xray/config.json:ro" \
    --entrypoint xray gozargah/marzban:latest run -c /etc/xray/config.json >/dev/null
  sleep 2
  code=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 --max-time 20 -x http://127.0.0.1:18080 https://www.google.com/generate_204 || echo 000)
  echo "$name proxy_http=$code"
  docker logs xray-test-client 2>&1 | grep -E 'Error|REALITY|accepted' | tail -8 || true
  docker rm -f xray-test-client >/dev/null 2>&1 || true
}
prove RU /tmp/xray-ru.json
prove DE /tmp/xray-de.json

echo "=== core vs disk ==="
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 -c 'import sys,json;r=json.load(sys.stdin)["inbounds"][0]["streamSettings"]["realitySettings"];print({k:r.get(k) for k in ("privateKey","publicKey","shortIds","dest","serverNames")})'
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json;print([(n.get("name"),n.get("status")) for n in json.load(sys.stdin)])'
