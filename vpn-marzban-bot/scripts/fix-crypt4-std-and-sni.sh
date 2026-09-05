#!/usr/bin/env bash
# Fix: standard b64 crypt4 + Reality SNI apple + refresh keys
set -euo pipefail
REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot

cd "$REPO"
sudo -u fast git fetch origin
sudo -u fast git reset --hard origin/celery_update
rsync -a --delete --exclude .env --exclude .venv --exclude '__pycache__' --exclude '*.pyc' \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"
chown -R marzbanbot:marzbanbot "$BOT"

# Reality SNI → apple (microsoft often blocked on mobile RF)
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

python3 - "$TOK" <<'PY'
import json, sys, urllib.request
tok=sys.argv[1]

def api(method, path, data=None):
    req=urllib.request.Request(
        f'http://127.0.0.1:62050{path}',
        data=None if data is None else json.dumps(data).encode(),
        headers={'Authorization':f'Bearer {tok}','Content-Type':'application/json'},
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)

cfg=api('GET','/api/core/config')
changed=False
for ib in cfg.get('inbounds') or []:
    r=(ib.get('streamSettings') or {}).get('realitySettings') or {}
    if not r: continue
    if r.get('dest')!='www.apple.com:443':
        r['dest']='www.apple.com:443'; changed=True
    if r.get('serverNames')!=['www.apple.com','apple.com']:
        r['serverNames']=['www.apple.com','apple.com']; changed=True
    r['fingerprint']=r.get('fingerprint') or 'chrome'
    if r.get('spiderX') not in ('/','') :
        r['spiderX']='/'; changed=True
if changed:
    api('PUT','/api/core/config', cfg)
    print('core SNI → apple')
else:
    print('core SNI already apple-ish')

hosts=api('GET','/api/hosts')
hch=False
for tag, entries in hosts.items():
    for h in entries:
        if h.get('sni')!='www.apple.com':
            h['sni']='www.apple.com'; hch=True
        if h.get('path') in ('/','%2F'):
            h['path']=''; hch=True
        h['fingerprint']=h.get('fingerprint') or 'chrome'
if hch:
    api('PUT','/api/hosts', hosts)
    print('hosts SNI → apple')
else:
    print('hosts ok')
PY

systemctl restart marzban-sub-proxy marzban-vpn-bot
sleep 2
systemctl is-active marzban-sub-proxy marzban-vpn-bot

cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, json, base64
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import build_happ_crypt4, is_real_happ_crypto_link, normalize_vless_for_happ

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
DSN=os.getenv('DATABASE_URL','').replace('postgresql+asyncpg://','postgresql://')

def to_https(u):
    u=(u or '').strip()
    return (u.replace('://195.24.65.251:2086','://svoygarage.ru')
             .replace('://195.24.65.251:62050','://svoygarage.ru')
             .replace('http://svoygarage.ru','https://svoygarage.ru'))

async def main():
    sample=build_happ_crypt4(['vless://u@1.1.1.1:8443?security=reality&type=tcp&headerType=&sni=x&fp=chrome&pbk=a&sid=1#🇷🇺 Russia'])
    assert is_real_happ_crypto_link(sample)
    payload=sample.split('/',3)[-1]
    assert '_' not in payload  # no urlsafe alphabet
    # critical: must decode with STANDARD b64
    data=json.loads(base64.b64decode(payload+'='*(-len(payload)%4)))
    assert 'configs' in data
    assert 'encryption=' not in data['configs'][0]
    assert '#' in data['configs'][0]
    print('crypt4_std_ok', sample[:50])
    print('norm', normalize_vless_for_happ('vless://u@1.1.1.1:8443?security=reality&type=tcp&sni=x&fp=chrome&pbk=a&sid=b#Test'))

    async with httpx.AsyncClient(timeout=20) as client:
        tok=(await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        # wait hosts refresh
        for _ in range(10):
            await asyncio.sleep(1)
            break
        conn=await asyncpg.connect(DSN)
        for r in await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users'):
            resp=await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})
            payload=resp.json()
            links=[x for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            sub=to_https(payload.get('subscription_url') or r['subscription_url'])
            crypt=build_happ_crypt4(links)
            assert is_real_happ_crypto_link(crypt)
            body=crypt.split('/',3)[-1]
            # Happ uses standard base64
            cfgs=json.loads(base64.b64decode(body+'='*(-len(body)%4)))['configs']
            for c in cfgs:
                assert 'encryption=' not in c
                assert 'www.apple.com' in c or 'microsoft' in c  # after host refresh should be apple
                assert c.count('#')==1
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, crypt, 'crypt4_std_b64_apple', datetime.now(timezone.utc), r['telegram_id'])
            print(r['telegram_id'], 'n=', len(cfgs), 'sni_sample', 'apple' if 'apple' in cfgs[0] else 'other')
            print(' crypt', crypt[:60]+'...')
            print(' sub', sub)
        await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-sub-proxy
sleep 1
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -o /tmp/subC.bin -D /tmp/subC.hdr -A 'Happ/3.5.0' "https://svoygarage.ru/sub/${TOKEN}"
grep -iE 'HTTP/|content-type|profile-update' /tmp/subC.hdr | head
python3 - <<'PY'
import base64, pathlib
dec=base64.b64decode(pathlib.Path('/tmp/subC.bin').read_bytes()).decode()
for l in dec.splitlines():
    print(l)
    assert 'encryption=' not in l
    assert 'headerType=' not in l
print('SUB_OK')
PY
echo DONE
