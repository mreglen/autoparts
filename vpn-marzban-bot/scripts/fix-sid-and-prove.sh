#!/usr/bin/env bash
# Fix empty sid in Marzban links + prove Reality client works
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
SID_GOOD='e0407c966b24646b'

python3 - "$TOK" "$SID_GOOD" <<'PY'
import json,sys,urllib.request
tok, sid = sys.argv[1], sys.argv[2]
def api(m,p,d=None):
  req=urllib.request.Request(f'http://127.0.0.1:62050{p}',
    data=None if d is None else json.dumps(d).encode(),
    headers={'Authorization':f'Bearer {tok}','Content-Type':'application/json'}, method=m)
  with urllib.request.urlopen(req) as r: return json.load(r)
cfg=api('GET','/api/core/config')
for ib in cfg.get('inbounds') or []:
  r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
  if not r: continue
  # non-empty FIRST so Marzban puts it into user links
  r['shortIds']=[sid]
  r['dest']='www.apple.com:443'
  r['serverNames']=['www.apple.com','apple.com']
  r['fingerprint']='chrome'
  r['spiderX']='/'
api('PUT','/api/core/config',cfg)
print('shortIds forced to', [sid])

hosts=api('GET','/api/hosts')
for tag, entries in hosts.items():
  for h in entries:
    h['sni']='www.apple.com'
    h['path']=''
    h['fingerprint']='chrome'
api('PUT','/api/hosts', hosts)
print('hosts refreshed')
PY

sleep 3
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" | python3 -c '
import sys,json,urllib.parse
u=json.load(sys.stdin)
for L in u.get("links") or []:
  q=urllib.parse.parse_qs(urllib.parse.urlparse(L).query)
  print("sid=", q.get("sid"), "pbk=", (q.get("pbk") or [""])[0][:16], "sni=", q.get("sni"))
  print(L[:120],"...")
  open("/tmp/rawlink.txt","w").write([x for x in u.get("links") if "195.24.65.251" in x][0])
'

python3 - <<'PY'
import json, urllib.parse
link=open('/tmp/rawlink.txt').read().strip()
u=urllib.parse.urlparse(link)
q={k:v for k,v in urllib.parse.parse_qsl(u.query) if v}
# keep only needed
keep={}
for k in ("security","type","flow","sni","fp","pbk","sid"):
  if k in q: keep[k]=q[k]
assert keep.get("sid"), keep
uuid, hostport = u.netloc.split("@")
host, port = hostport.rsplit(":",1)
open("/tmp/minlink.txt","w").write(f"vless://{u.netloc}?{urllib.parse.urlencode(keep)}#Russia\n")
cfg={
  "log":{"loglevel":"warning"},
  "outbounds":[{
    "protocol":"vless",
    "settings":{"vnext":[{"address":host,"port":int(port),"users":[{"id":uuid,"encryption":"none","flow":keep.get("flow","")}]}]},
    "streamSettings":{
      "network":"tcp",
      "security":"reality",
      "realitySettings":{
        "serverName": keep["sni"],
        "fingerprint": keep.get("fp","chrome"),
        "publicKey": keep["pbk"],
        "shortId": keep["sid"],
        "spiderX": "/"
      }
    }
  }],
  "inbounds":[{"listen":"127.0.0.1","port":18080,"protocol":"http"}]
}
json.dump(cfg, open("/tmp/xray-client.json","w"))
print("min", open("/tmp/minlink.txt").read().strip())
print("sid", keep["sid"])
PY

docker rm -f xray-test-client >/dev/null 2>&1 || true
# pull a known xray image
docker run -d --name xray-test-client --network host \
  -v /tmp/xray-client.json:/etc/xray/config.json:ro \
  teddysun/xray:latest 2>/dev/null || \
docker run -d --name xray-test-client --network host \
  -v /tmp/xray-client.json:/etc/xray/config.json:ro \
  ghcr.io/xtls/xray-core:25.3.6 2>/dev/null || \
docker run -d --name xray-test-client --network host \
  -v /tmp/xray-client.json:/etc/xray/config.json:ro \
  --entrypoint xray gozargah/marzban:latest run -c /etc/xray/config.json

sleep 3
docker logs xray-test-client 2>&1 | tail -20
echo "=== curl via proxy ==="
curl -sS -o /dev/null -w "code=%{http_code} time=%{time_total}\n" \
  --connect-timeout 12 --max-time 20 \
  -x http://127.0.0.1:18080 https://www.google.com/generate_204 || echo FAIL
curl -sS -o /dev/null -w "cf=%{http_code}\n" --connect-timeout 12 --max-time 20 \
  -x http://127.0.0.1:18080 https://cp.cloudflare.com/generate_204 || echo FAIL2
docker rm -f xray-test-client >/dev/null 2>&1 || true
