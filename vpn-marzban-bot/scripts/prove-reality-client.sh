#!/usr/bin/env bash
# Prove VLESS-Reality works with a local xray client, then simplify delivery.
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Ensure shortIds includes empty + current
python3 - "$TOK" <<'PY'
import json,sys,urllib.request
tok=sys.argv[1]
def api(m,p,d=None):
  req=urllib.request.Request(f'http://127.0.0.1:62050{p}',
    data=None if d is None else json.dumps(d).encode(),
    headers={'Authorization':f'Bearer {tok}','Content-Type':'application/json'}, method=m)
  with urllib.request.urlopen(req) as r: return json.load(r)
cfg=api('GET','/api/core/config')
changed=False
for ib in cfg.get('inbounds') or []:
  r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
  if not r: continue
  sids=list(r.get('shortIds') or [])
  if '' not in sids:
    sids = [''] + sids
    r['shortIds']=sids; changed=True
  # keep apple dest
  r['dest']='www.apple.com:443'
  r['serverNames']=['www.apple.com','apple.com']
  r['fingerprint']='chrome'
  r['spiderX']='/'
if changed:
  api('PUT','/api/core/config',cfg); print('added empty shortId')
else:
  print('shortIds ok', cfg['inbounds'][0]['streamSettings']['realitySettings'].get('shortIds'))
PY

USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
LINK=$(curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" | python3 -c 'import sys,json;print([l for l in json.load(sys.stdin).get("links") or [] if "195.24.65.251" in l][0])')
echo "RAW_LINK=$LINK"

# Build minimal client link
MIN=$(python3 - <<PY
from urllib.parse import urlparse, parse_qsl, urlencode, quote
import os
link=os.environ.get("L") or '''$LINK'''
# split
main, rem = (link.split("#",1)+[""])[:2]
p=urlparse(main)
q=dict(parse_qsl(p.query, keep_blank_values=False))
q={k:v for k,v in q.items() if v}
keep={}
for k in ("security","type","flow","sni","fp","pbk","sid"):
  if k in q: keep[k]=q[k]
# minimal: no headerType/path/host/spx/encryption
out=f"vless://{p.netloc}?{urlencode(keep)}#Russia"
print(out)
PY
)
echo "MIN_LINK=$MIN"

# Local xray client test via docker
python3 - <<'PY' > /tmp/xray-client.json
import json, os, urllib.parse, re
link=open('/tmp/minlink.txt').read().strip() if False else None
PY

# write min link file from shell
printf '%s\n' "$MIN" > /tmp/minlink.txt

python3 - <<'PY'
import json, urllib.parse
link=open('/tmp/minlink.txt').read().strip()
u=urllib.parse.urlparse(link)
q=dict(urllib.parse.parse_qsl(u.query))
uuid, hostport = u.netloc.split('@')
host, port = hostport.rsplit(':',1)
cfg={
  "log":{"loglevel":"warning"},
  "outbounds":[{
    "protocol":"vless",
    "settings":{"vnext":[{"address":host,"port":int(port),"users":[{"id":uuid,"encryption":"none","flow":q.get("flow","")}]}]},
    "streamSettings":{
      "network":"tcp",
      "security":"reality",
      "realitySettings":{
        "serverName": q.get("sni"),
        "fingerprint": q.get("fp","chrome"),
        "publicKey": q.get("pbk"),
        "shortId": q.get("sid",""),
        "spiderX": "/"
      }
    }
  },{"protocol":"freedom","tag":"direct"}],
  "inbounds":[{"listen":"127.0.0.1","port":18080,"protocol":"http"}]
}
json.dump(cfg, open('/tmp/xray-client.json','w'))
print('client cfg written')
print(json.dumps(cfg['outbounds'][0], indent=2)[:500])
PY

# run client briefly and curl via proxy
docker run -d --rm --name xray-test-client --network host \
  -v /tmp/xray-client.json:/etc/xray/config.json:ro \
  teddysun/xray:latest >/dev/null 2>&1 || \
docker run -d --rm --name xray-test-client --network host \
  -v /tmp/xray-client.json:/etc/xray/config.json:ro \
  ghcr.io/xtls/xray-core:latest >/dev/null 2>&1 || true

sleep 2
echo "=== curl via local reality client ==="
curl -sS -o /dev/null -w "via_proxy_http=%{http_code} time=%{time_total}\n" \
  --connect-timeout 10 --max-time 15 \
  -x http://127.0.0.1:18080 https://cp.cloudflare.com/generate_204 || echo PROXY_FAIL
curl -sS -o /dev/null -w "direct=%{http_code}\n" --connect-timeout 5 https://cp.cloudflare.com/generate_204 || true
docker rm -f xray-test-client >/dev/null 2>&1 || true
