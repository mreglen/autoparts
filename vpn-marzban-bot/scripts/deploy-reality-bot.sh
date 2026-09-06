#!/bin/bash
set -euo pipefail
BOT=/opt/marzban-vpn-bot
for f in happ_crypto.py handlers.py marzban_api.py sub_proxy.py; do
  [[ -f /tmp/$f ]] && cp /tmp/$f "$BOT/$f" && echo deployed $f
done
chown -R marzbanbot:marzbanbot "$BOT"
systemctl restart marzban-sub-proxy marzban-vpn-bot
sleep 2
systemctl is-active marzban-sub-proxy marzban-vpn-bot

cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import (
    build_happ_add_link, build_simple_vless_links,
    DEFAULT_REALITY_PBK, DEFAULT_REALITY_SID, DEFAULT_REALITY_SNI,
)

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
    async with httpx.AsyncClient(timeout=20) as client:
        tok=(await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        conn=await asyncpg.connect(DSN)
        for r in await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users'):
            payload=(await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})).json()
            links=[x for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            cleaned=build_simple_vless_links(links)
            assert cleaned
            for c in cleaned:
                assert 'security=reality' in c
                assert f'pbk={DEFAULT_REALITY_PBK}' in c
                assert f'sid={DEFAULT_REALITY_SID}' in c
                assert f'sni={DEFAULT_REALITY_SNI}' in c
                assert 'flow=xtls-rprx-vision' in c
            sub=to_https(payload.get('subscription_url') or r['subscription_url'] or '')
            add=build_happ_add_link(sub)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, add, 'happ_add_reality', datetime.now(timezone.utc), r['telegram_id'])
            print(r['telegram_id'], add)
            for c in cleaned:
                print(' ', c[:160])
        await conn.close()
asyncio.run(main())
PY

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -A Happ/3 "https://svoygarage.ru/sub/$TOKEN" | python3 -c 'import sys,base64;t=sys.stdin.read().strip();
try:d=base64.b64decode(t).decode()
except Exception:d=t
print(d)
assert "reality" in d and "dl.google.com" in d and "7j2jGKpCPkiERzSDCEzoi8jhLFM6X4ZcgCg_jhGa9Cc" in d
print("SUB_OK")'
echo DONE
