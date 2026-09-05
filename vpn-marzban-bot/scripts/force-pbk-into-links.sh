#!/usr/bin/env bash
set -euo pipefail
PUB=$(cat /root/marzban-vpn-reality-public.key | tr -d '[:space:]')
SID=$(cat /root/marzban-vpn-reality-shortid.txt | tr -d '[:space:]')
PRIV=$(cat /root/marzban-vpn-reality-private.key | tr -d '[:space:]')
echo "PUB=$PUB SID=$SID"

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - "$TOK" "$PRIV" "$PUB" "$SID" <<'PY'
import json,sys,urllib.request
tok,priv,pub,sid=sys.argv[1:5]
def api(m,p,d=None):
  req=urllib.request.Request(f'http://127.0.0.1:62050{p}',
    data=None if d is None else json.dumps(d).encode(),
    headers={'Authorization':f'Bearer {tok}','Content-Type':'application/json'}, method=m)
  with urllib.request.urlopen(req) as r: return json.load(r)
cfg=api('GET','/api/core/config')
for ib in cfg.get('inbounds') or []:
  r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
  if not r: continue
  r['privateKey']=priv
  r['shortIds']=[sid]
  # some Marzban builds keep publicKey for subscription link rendering
  r['publicKey']=pub
  r['dest']='www.apple.com:443'
  r['serverNames']=['www.apple.com','apple.com']
  r['fingerprint']='chrome'
  r['spiderX']='/'
api('PUT','/api/core/config',cfg)
print('core publicKey set')
# show one link
import os
user=os.popen("sudo -u postgres psql -d autoparts -tAc \"select marzban_username from marzvpn_users where telegram_id=768651771\"").read().strip()
u=api('GET', f'/api/user/{user}')
print('marzban link pbk check:')
for L in u.get('links') or []:
  print(L)
PY

# Force happ_crypto defaults
for f in /opt/marzban-vpn-bot/happ_crypto.py /home/fast/autoparts/vpn-marzban-bot/bot/happ_crypto.py; do
  [[ -f "$f" ]] || continue
  sed -i "s|^DEFAULT_REALITY_SID = .*|DEFAULT_REALITY_SID = \"${SID}\"|" "$f"
  if grep -q 'DEFAULT_REALITY_PBK' "$f"; then
    sed -i "s|^DEFAULT_REALITY_PBK = .*|DEFAULT_REALITY_PBK = \"${PUB}\"|" "$f"
  else
    sed -i "/DEFAULT_REALITY_SID/a DEFAULT_REALITY_PBK = \"${PUB}\"" "$f"
  fi
done

# Patch normalize to always force pbk+sid
python3 - <<'PY'
from pathlib import Path
p=Path('/opt/marzban-vpn-bot/happ_crypto.py')
t=p.read_text()
if 'DEFAULT_REALITY_PBK' not in t:
    t=t.replace(
        'DEFAULT_REALITY_SID = "',
        'DEFAULT_REALITY_SID = "'  # noop
    )
# ensure force pbk block exists
needle='    if not params.get("sid"):\n        params["sid"] = DEFAULT_REALITY_SID'
force='''    if not params.get("sid"):
        params["sid"] = DEFAULT_REALITY_SID
    # Always pin working Reality public key (Marzban may cache stale pbk in links)
    params["pbk"] = DEFAULT_REALITY_PBK
    params["sid"] = DEFAULT_REALITY_SID'''
if 'params["pbk"] = DEFAULT_REALITY_PBK' not in t:
    if needle in t:
        t=t.replace(needle, force)
    else:
        raise SystemExit('needle missing')
p.write_text(t)
print('patched happ_crypto force pbk/sid')
PY

systemctl restart marzban-sub-proxy marzban-vpn-bot
sleep 2

cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import build_happ_add_link, build_simple_vless_links, DEFAULT_REALITY_PBK, DEFAULT_REALITY_SID
print('defaults', DEFAULT_REALITY_PBK, DEFAULT_REALITY_SID)
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
      links=[x for x in (resp.json().get('links') or []) if isinstance(x,str)]
      cleaned=build_simple_vless_links(links)
      for c in cleaned:
        assert DEFAULT_REALITY_PBK in c and DEFAULT_REALITY_SID in c
        print(c)
      sub=to_https(resp.json().get('subscription_url') or r['subscription_url'])
      await conn.execute('update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true, verify_note=$3, last_verified_at=$4 where telegram_id=$5',
        sub, build_happ_add_link(sub), 'happ_add_https', datetime.now(timezone.utc), r['telegram_id'])
    await conn.close()
asyncio.run(main())
PY

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
curl -sS -o /tmp/s2.bin -A 'Happ/3.5.0' "https://svoygarage.ru/sub/${TOKEN}"
python3 - <<PY
import base64
dec=base64.b64decode(open('/tmp/s2.bin','rb').read()).decode()
print(dec)
assert '$PUB' in dec and '$SID' in dec
print('SUB_PBK_OK')
PY

# prove with public IP too
UUID=$(python3 -c 'import base64,re;d=base64.b64decode(open("/tmp/s2.bin","rb").read()).decode().splitlines()[0];print(re.match(r"vless://([^@]+)@",d).group(1))')
python3 - <<PY
import json
cfg={
 "log":{"loglevel":"warning"},
 "inbounds":[{"listen":"127.0.0.1","port":18080,"protocol":"http"}],
 "outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"195.24.65.251","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},
 "streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"www.apple.com","fingerprint":"chrome","publicKey":"$PUB","shortId":"$SID","spiderX":"/"}}}]
}
json.dump(cfg, open('/tmp/xray-client.json','w'))
PY
docker rm -f xray-test-client >/dev/null 2>&1 || true
docker run -d --name xray-test-client --network host -v /tmp/xray-client.json:/etc/xray/config.json:ro --entrypoint xray gozargah/marzban:latest run -c /etc/xray/config.json >/dev/null
sleep 2
curl -sS -o /dev/null -w "public_ip_proxy=%{http_code} t=%{time_total}\n" --connect-timeout 15 --max-time 25 -x http://127.0.0.1:18080 https://www.google.com/generate_204 || echo FAIL
docker logs xray-test-client 2>&1 | tail -8 || true
docker rm -f xray-test-client >/dev/null 2>&1 || true
echo ALL_DONE
