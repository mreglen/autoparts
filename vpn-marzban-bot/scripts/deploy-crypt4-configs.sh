#!/usr/bin/env bash
# Deploy crypt4 {"configs":[...]} + sanitize remarks, refresh DB
set -euo pipefail
REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot

cd "$REPO"
sudo -u fast git pull --ff-only origin celery_update || true

rsync -a --delete \
  --exclude .env --exclude .venv --exclude '__pycache__' --exclude '*.pyc' \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"

systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot

cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, json, base64
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_happ_crypt4_clean, is_real_happ_crypto_link

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
DSN=os.getenv('DATABASE_URL','').replace('postgresql+asyncpg://','postgresql://')

def to_https(u: str) -> str:
    u=(u or '').strip()
    return (u.replace('://195.24.65.251:2086','://svoygarage.ru')
             .replace('://195.24.65.251:62050','://svoygarage.ru')
             .replace('http://svoygarage.ru','https://svoygarage.ru'))

async def main():
    dirty='vless://u@1.1.1.1:8443?security=reality&type=tcp&headerType=&path=&host=&sni=www.microsoft.com&fp=chrome#🇷🇺 Russia | Test'
    sample = generate_happ_crypt4_clean([dirty])
    assert is_real_happ_crypto_link(sample)
    data=json.loads(base64.b64decode(sample.split('/',3)[-1]))
    cfg=data['configs'][0]
    assert 'headerType=' not in cfg and 'path=' not in cfg and 'host=' not in cfg
    assert 'security=reality' in cfg and 'sni=www.microsoft.com' in cfg
    from urllib.parse import unquote as uq
    print('smoke_ok', cfg.split('?',1)[1].split('#')[0], 'remark=', uq(cfg.split('#',1)[1]))

    async with httpx.AsyncClient(timeout=20) as client:
        tok=(await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        conn=await asyncpg.connect(DSN)
        rows=await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users')
        for r in rows:
            resp=await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})
            if resp.status_code!=200:
                print('skip', r['telegram_id'], resp.status_code)
                continue
            payload=resp.json()
            links=[x for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            if not links:
                print('NO_LINKS', r['telegram_id'])
                continue
            sub=to_https(payload.get('subscription_url') or r['subscription_url'])
            crypt=generate_happ_crypt4_clean(links)
            assert is_real_happ_crypto_link(crypt)
            cfgs=json.loads(base64.b64decode(crypt.split('/',3)[-1]))['configs']
            print(r['telegram_id'], 'n=', len(cfgs), crypt[:55]+'...')
            for c in cfgs:
                q=c.split('?',1)[1].split('#',1)[0] if '?' in c else ''
                bad=[p for p in q.split('&') if p.endswith('=') or p.endswith('=&')]
                print(' ', c.split('@')[1].split('?')[0] if '@' in c else c[:30], 'q=', q[:80], 'bad=', bad)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, crypt, 'crypt4_clean_query', datetime.now(timezone.utc), r['telegram_id'])
        await conn.close()
asyncio.run(main())
PY

echo DONE
