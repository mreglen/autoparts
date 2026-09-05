#!/usr/bin/env bash
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

echo "==> nodes"
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes \
  | python3 -c 'import sys,json;print([(n.get("name"),n.get("status")) for n in json.load(sys.stdin)])'

echo "==> marzban users count"
curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/users?limit=5" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("total",d.get("total"), "sample",[u.get("username") for u in (d.get("users") or [])[:5]])'

# Recreate missing users from postgres + issue official happ keys
cd /opt/marzban-vpn-bot
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  /home/fast/autoparts/vpn-marzban-bot/bot/ /opt/marzban-vpn-bot/
chown -R marzbanbot:marzbanbot /opt/marzban-vpn-bot

sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re, secrets, time
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_happ_official_crypto, generate_happ_add_link, is_real_happ_crypto_link

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
INBOUND=os.getenv('INBOUND_TAG','VLESS TCP REALITY')
HTTPS='https://svoygarage.ru'
LIMIT_GB=float(os.getenv('DATA_LIMIT_GB','50'))

def to_https(url: str) -> str:
    m=re.search(r'/sub/([^?\s#]+)', url or '')
    if not m:
        raise RuntimeError(f'bad sub url {url!r}')
    return f"{HTTPS}/sub/{m.group(1)}"

def build_username(tg_id: int) -> str:
    return f"tg_{tg_id}_{secrets.token_hex(3)}"[:32]

async def main():
    db=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')
    conn=await asyncpg.connect(db)
    rows=await conn.fetch('select telegram_id, username, marzban_username, expire_at, referrer_id from marzvpn_users')
    async with httpx.AsyncClient(timeout=45.0, follow_redirects=True) as c:
        tok=(await c.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        h={'Authorization':f'Bearer {tok}'}
        for r in rows:
            tg=r['telegram_id']
            uname=r['marzban_username']
            expire_at=r['expire_at']
            if expire_at.tzinfo is None:
                expire_at=expire_at.replace(tzinfo=timezone.utc)
            expire_ts=int(expire_at.timestamp())
            # check existing
            resp=await c.get(f'{BASE}/api/user/{uname}', headers=h)
            if resp.status_code == 404:
                uname=build_username(tg)
                body={
                    'username': uname,
                    'proxies': {'vless': {'flow': 'xtls-rprx-vision'}},
                    'inbounds': {'vless': [INBOUND]},
                    'expire': expire_ts,
                    'data_limit': int(LIMIT_GB*(1024**3)) if LIMIT_GB>0 else 0,
                    'data_limit_reset_strategy': 'no_reset',
                    'status': 'active',
                    'note': f'tg:{tg}-restored',
                }
                cr=await c.post(f'{BASE}/api/user', headers=h, json=body)
                print('create', uname, cr.status_code, cr.text[:120])
                cr.raise_for_status()
                data=cr.json()
            else:
                # ensure active + expire
                data=resp.json()
                await c.put(f'{BASE}/api/user/{uname}', headers=h, json={
                    'status':'active',
                    'expire': expire_ts,
                })
                data=(await c.get(f'{BASE}/api/user/{uname}', headers=h)).json()
                print('reuse', uname, data.get('status'))

            sub=to_https(data.get('subscription_url') or '')
            for link in data.get('links') or []:
                print(' ', 'BAD_PATH' if ('path=%2F' in link or 'path=/' in link) else 'OK', link[:130])
            probe=await c.get(sub, headers={'User-Agent':'Happ/3.5.0'})
            print(' sub', sub, probe.status_code, probe.headers.get('content-type'))
            assert probe.status_code==200 and len(probe.content)>50
            crypt=generate_happ_official_crypto(sub)
            assert crypt.startswith('happ://crypt')
            await conn.execute(
                '''update marzvpn_users
                   set marzban_username=$1, subscription_url=$2, crypt4_link=$3,
                       key_valid=true, verify_note=$4, last_verified_at=$5
                   where telegram_id=$6''',
                uname, sub, crypt, 'recreated_official_crypto', datetime.now(timezone.utc), tg,
            )
            print(' add', generate_happ_add_link(sub))
            print(' crypt', crypt[:72], '...')
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot

# final verify
sudo -u postgres psql -d autoparts -c "select telegram_id, marzban_username, left(subscription_url,55) sub, left(crypt4_link,40) crypt from marzvpn_users;"
echo RECREATE_USERS_OK
