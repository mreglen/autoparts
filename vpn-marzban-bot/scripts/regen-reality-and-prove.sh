#!/usr/bin/env bash
# Regenerate Reality keys + prove localhost client with same xray as Marzban
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

echo "==> generate new reality keys via marzban image xray"
KEYS=$(docker run --rm --entrypoint xray gozargah/marzban:latest x25519)
echo "$KEYS"
PRIV=$(echo "$KEYS" | awk '/Private/{print $NF}')
PUB=$(echo "$KEYS" | awk '/Public/{print $NF}')
SID=$(openssl rand -hex 8)
echo "PRIV=$PRIV"
echo "PUB=$PUB"
echo "SID=$SID"
echo "$PUB" > /root/marzban-vpn-reality-public.key
echo "$PRIV" > /root/marzban-vpn-reality-private.key
echo "$SID" > /root/marzban-vpn-reality-shortid.txt

python3 - "$TOK" "$PRIV" "$PUB" "$SID" <<'PY'
import json,sys,urllib.request,pathlib
tok,priv,pub,sid=sys.argv[1:5]

def api(m,p,d=None):
  req=urllib.request.Request(f'http://127.0.0.1:62050{p}',
    data=None if d is None else json.dumps(d).encode(),
    headers={'Authorization':f'Bearer {tok}','Content-Type':'application/json'}, method=m)
  with urllib.request.urlopen(req) as r: return json.load(r)

cfg=api('GET','/api/core/config')
for ib in cfg.get('inbounds') or []:
  ss=ib.setdefault('streamSettings',{})
  r=ss.setdefault('realitySettings',{})
  r['privateKey']=priv
  # publicKey may be derived; Marzban/xray uses privateKey server-side
  r['shortIds']=[sid]
  r['dest']='www.apple.com:443'
  r['serverNames']=['www.apple.com','apple.com']
  r['fingerprint']='chrome'
  r['spiderX']='/'
  r['show']=False
api('PUT','/api/core/config',cfg)

# sync disk file too
disk=pathlib.Path('/var/lib/marzban-vpn/xray_config.json')
dc=json.loads(disk.read_text())
for ib in dc.get('inbounds') or []:
  r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
  if not r: continue
  r['privateKey']=priv
  r['shortIds']=[sid]
  r['dest']='www.apple.com:443'
  r['serverNames']=['www.apple.com','apple.com']
  r['fingerprint']='chrome'
  r['spiderX']='/'
disk.write_text(json.dumps(dc, indent=2))

hosts=api('GET','/api/hosts')
for _, entries in hosts.items():
  for h in entries:
    h['sni']='www.apple.com'
    h['path']=''
    h['fingerprint']='chrome'
api('PUT','/api/hosts', hosts)
print('updated core+hosts+disk')
print('PUBLIC', pub, 'SID', sid)
open('/tmp/reality.pub','w').write(pub)
open('/tmp/reality.sid','w').write(sid)
PY

sleep 5
# confirm public from private
docker run --rm --entrypoint xray gozargah/marzban:latest x25519 -i "$(cat /root/marzban-vpn-reality-private.key)"

USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
# wait panel
for i in $(seq 1 20); do curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:62050/docs | grep -q 200 && break; sleep 1; done
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# rebuild bot defaults SID in happ_crypto via env file snippet? inject via normalize using live sid
PUB=$(cat /tmp/reality.pub)
SID=$(cat /tmp/reality.sid)

# update DEFAULT in happ_crypto on server
sed -i "s/^DEFAULT_REALITY_SID = .*/DEFAULT_REALITY_SID = \"${SID}\"/" /opt/marzban-vpn-bot/happ_crypto.py
# also in repo copy
sed -i "s/^DEFAULT_REALITY_SID = .*/DEFAULT_REALITY_SID = \"${SID}\"/" /home/fast/autoparts/vpn-marzban-bot/bot/happ_crypto.py || true

systemctl restart marzban-sub-proxy
sleep 2

# get uuid from user
UUID=$(curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" | python3 -c 'import sys,json,re;u=json.load(sys.stdin);L=u["links"][0];print(re.match(r"vless://([^@]+)@",L).group(1))')
echo "UUID=$UUID PUB=$PUB SID=$SID"

python3 - <<PY
import json
uuid="$UUID"; pub="$PUB"; sid="$SID"
cfg={
 "log":{"loglevel":"debug"},
 "inbounds":[{"listen":"127.0.0.1","port":18080,"protocol":"http"}],
 "outbounds":[{
  "protocol":"vless",
  "settings":{"vnext":[{"address":"127.0.0.1","port":8443,"users":[{"id":uuid,"encryption":"none","flow":"xtls-rprx-vision"}]}]},
  "streamSettings":{"network":"tcp","security":"reality","realitySettings":{
    "serverName":"www.apple.com","fingerprint":"chrome","publicKey":pub,"shortId":sid,"spiderX":"/"
  }}
 }]
}
json.dump(cfg, open('/tmp/xray-client.json','w'), indent=2)
print('wrote localhost client')
PY

docker rm -f xray-test-client >/dev/null 2>&1 || true
# use SAME image family as marzban
docker run -d --name xray-test-client --network host \
  -v /tmp/xray-client.json:/etc/xray/config.json:ro \
  --entrypoint xray gozargah/marzban:latest run -c /etc/xray/config.json
sleep 3
echo "=== proxy test localhost Reality ==="
curl -sS -o /dev/null -w "code=%{http_code} t=%{time_total}\n" --connect-timeout 15 --max-time 25 \
  -x http://127.0.0.1:18080 https://www.google.com/generate_204 || echo FAIL
docker logs xray-test-client 2>&1 | tail -25
docker rm -f xray-test-client >/dev/null 2>&1 || true

# refresh DB links + sub
cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import build_happ_add_link, build_simple_vless_links
BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin'); PASS=os.getenv('MARZBAN_PASSWORD','')
DSN=os.getenv('DATABASE_URL','').replace('postgresql+asyncpg://','postgresql://')
def to_https(u):
  return (u or '').replace('://195.24.65.251:2086','://svoygarage.ru').replace('://195.24.65.251:62050','://svoygarage.ru').replace('http://svoygarage.ru','https://svoygarage.ru')
async def main():
  async with httpx.AsyncClient(timeout=20) as client:
    tok=(await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
    conn=await asyncpg.connect(DSN)
    for r in await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users'):
      resp=await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})
      payload=resp.json()
      links=[x for x in (payload.get('links') or []) if isinstance(x,str)]
      cleaned=build_simple_vless_links(links)
      print(r['telegram_id'])
      for c in cleaned: print(' ', c)
      sub=to_https(payload.get('subscription_url') or r['subscription_url'])
      await conn.execute('update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true, verify_note=$3, last_verified_at=$4 where telegram_id=$5',
        sub, build_happ_add_link(sub), 'happ_add_https', datetime.now(timezone.utc), r['telegram_id'])
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot marzban-sub-proxy
echo DONE_PUB=$PUB
echo DONE_SID=$SID
