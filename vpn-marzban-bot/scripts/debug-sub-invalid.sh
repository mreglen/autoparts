#!/bin/bash
set -euo pipefail
cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, base64, json
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_valid_happ_link, is_real_happ_crypto_link

async def main():
    db = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(db)
    rows = await conn.fetch('''
      select telegram_id, marzban_username, subscription_url, crypt4_link, expire_at, key_valid, verify_note
      from marzvpn_users order by created_at desc
    ''')
    print(f'users={len(rows)}')
    for r in rows:
        print('===', r['telegram_id'], r['marzban_username'], '===')
        print('expire', r['expire_at'], 'valid', r['key_valid'], r['verify_note'])
        print('sub', r['subscription_url'])
        print('crypt', (r['crypt4_link'] or '')[:80], '...')
        print('real_crypto', is_real_happ_crypto_link(r['crypt4_link'] or ''))
        sub = r['subscription_url']
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as c:
            try:
                resp = await c.get(sub, headers={'User-Agent': 'Happ/3.0'})
                print('fetch', resp.status_code, 'len', len(resp.content), 'ctype', resp.headers.get('content-type'))
                # print profile headers happ cares about
                for h in ('subscription-userinfo','profile-update-interval','profile-title','support-url','announce','content-disposition'):
                    if h in resp.headers:
                        print(' hdr', h, resp.headers[h])
                body = resp.content
                text = body.decode('utf-8', errors='replace').strip()
                decoded = None
                if not text.startswith('vless://'):
                    try:
                        decoded = base64.b64decode(text).decode('utf-8', errors='replace')
                        print('b64_ok lines', len(decoded.splitlines()))
                        text = decoded
                    except Exception as e:
                        print('b64_fail', e)
                for i, line in enumerate(text.splitlines()[:3]):
                    print(f' line{i}', line[:160])
                    if 'sni=' in line:
                        import urllib.parse
                        q = line.split('?',1)[-1].split('#',1)[0]
                        p = {k:v[0] for k,v in urllib.parse.parse_qs(q).items()}
                        print('   sni', p.get('sni'), 'pbk', (p.get('pbk') or '')[:16], 'sid', p.get('sid'), 'fp', p.get('fp'))
            except Exception as e:
                print('FETCH_ERR', type(e).__name__, e)

            # compare with Marzban live subscription_url
            # re-encrypt fresh
            try:
                new_link = generate_valid_happ_link(sub)
                print('fresh_crypt', new_link[:70], '...')
                print('fresh_real', is_real_happ_crypto_link(new_link))
            except Exception as e:
                print('reencrypt_err', e)
    await conn.close()
asyncio.run(main())
PY

echo '=== MARZBAN USER SUB ==='
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users where telegram_id=768651771 order by created_at desc limit 1")
echo user=$USER
curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" | python3 -c 'import sys,json;u=json.load(sys.stdin);print("api_sub",u.get("subscription_url"));print("status",u.get("status"));print("links",len(u.get("links") or []))'
