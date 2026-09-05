#!/usr/bin/env bash
# Install sub normalizer proxy + point nginx /sub/ to it + refresh crypt4
set -euo pipefail

REPO=/home/fast/autoparts
BOT=/opt/marzban-vpn-bot
SITE=/etc/nginx/sites-available/svoygarage

cd "$REPO"
sudo -u fast git fetch origin
sudo -u fast git reset --hard origin/celery_update

rsync -a --delete \
  --exclude .env --exclude .venv --exclude '__pycache__' --exclude '*.pyc' \
  "$REPO/vpn-marzban-bot/bot/" "$BOT/"
chown -R marzbanbot:marzbanbot "$BOT"

# ensure aiohttp present
sudo -u marzbanbot "$BOT/.venv/bin/pip" install -q 'aiohttp>=3.9' || true

cat > /etc/systemd/system/marzban-sub-proxy.service <<'EOF'
[Unit]
Description=Marzban /sub/ normalizer for Happ VPN
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=marzbanbot
Group=marzbanbot
WorkingDirectory=/opt/marzban-vpn-bot
Environment=MARZBAN_SUB_UPSTREAM=http://127.0.0.1:62050
Environment=SUB_PROXY_HOST=127.0.0.1
Environment=SUB_PROXY_PORT=62060
ExecStart=/opt/marzban-vpn-bot/.venv/bin/python /opt/marzban-vpn-bot/sub_proxy.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now marzban-sub-proxy
sleep 1
systemctl is-active marzban-sub-proxy

# Point nginx /sub/ → local normalizer (62060)
python3 - "$SITE" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
block = """
    # === Happ-normalized Marzban subscriptions ===
    location /sub/ {
        proxy_pass http://127.0.0.1:62060/sub/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 15s;
        add_header Cache-Control "no-store" always;
        add_header profile-update-interval "24" always;
    }
"""
text2 = re.sub(
    r"(?m)^[ \t]*#(?:[^\n]*Marzban[^\n]*|[^\n]*subscription[^\n]*|[^\n]*Happ[^\n]*)\n(?:[ \t]*#[^\n]*\n)*"
    r"[ \t]*location\s+\^~\s+/sub/\s*\{.*?\n[ \t]*\}\n?",
    "",
    text,
    flags=re.S,
)
text2 = re.sub(r"(?m)^[ \t]*location\s+\^~\s+/sub/\s*\{.*?\n[ \t]*\}\n?", "", text2, flags=re.S)
text2 = re.sub(r"(?m)^[ \t]*location\s+/sub/\s*\{.*?\n[ \t]*\}\n?", "", text2, flags=re.S)

parts=[]; inserted=0
for m in re.finditer(r"(?m)^server\s*\{", text2):
    start=m.start(); depth=0; end=None
    for j in range(m.end()-1, len(text2)):
        ch=text2[j]
        if ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:
                end=j+1; break
    if end is None: continue
    block_s=text2[start:end]
    if not re.search(r"listen\s+[^;]*443", block_s): continue
    sm=re.search(r"(?m)^([ \t]*server_name[^\n]*;\n)", block_s) or re.search(r"(?m)^([ \t]*listen[^\n]*443[^\n]*;\n)", block_s)
    if not sm: continue
    parts.append((start,end, block_s[:sm.end()]+block+block_s[sm.end():])); inserted+=1
out=[]; last=0
for s,e,nb in parts:
    out.append(text2[last:s]); out.append(nb); last=e
out.append(text2[last:])
path.write_text(''.join(out), encoding='utf-8')
print('nginx /sub/ → 62060 in', inserted, 'ssl blocks')
PY

nginx -t
systemctl reload nginx

systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot

# Refresh DB crypt4 from live Marzban links
cd "$BOT"
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, json, base64
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import build_happ_crypt4, is_real_happ_crypto_link, normalize_vless_for_happ
from urllib.parse import urlparse

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
    dirty='vless://u@1.1.1.1:8443?security=reality&type=tcp&headerType=&path=&host=&sni=x&fp=chrome&pbk=abc&sid=1#🇷🇺 Russia'
    n=normalize_vless_for_happ(dirty)
    assert n.count('#') == 1
    assert 'encryption=none#' in n or ('encryption=none&' in n and '#' in n)
    assert 'noneRussia' not in n
    assert 'headerType=' not in n and 'path=' not in n and 'host=' not in n
    print('norm', n)

    async with httpx.AsyncClient(timeout=20) as client:
        tok=(await client.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        conn=await asyncpg.connect(DSN)
        for r in await conn.fetch('select telegram_id, marzban_username, subscription_url from marzvpn_users'):
            resp=await client.get(f"{BASE}/api/user/{r['marzban_username']}", headers={'Authorization':f'Bearer {tok}'})
            payload=resp.json()
            links=[x for x in (payload.get('links') or []) if isinstance(x,str) and x.startswith('vless://')]
            sub=to_https(payload.get('subscription_url') or r['subscription_url'])
            crypt=build_happ_crypt4(links)
            assert is_real_happ_crypto_link(crypt)
            pad='='*(-len(crypt.split('/',3)[-1])%4)
            cfgs=json.loads(base64.urlsafe_b64decode(crypt.split('/',3)[-1]+pad))['configs']
            for c in cfgs:
                assert c.count('#') == 1
                assert 'headerType=' not in c and 'path=' not in c
                assert 'encryption=none' in c
                after = c.split('encryption=none', 1)[1][:1]
                assert after in ('#', '&'), repr(after)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, crypt, 'crypt4_configs_hashsafe', datetime.now(timezone.utc), r['telegram_id'])
            print('user', r['telegram_id'], 'configs', len(cfgs), crypt[:48])
        await conn.close()
asyncio.run(main())
PY

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users limit 1" | tr -d '[:space:]')
echo "probe /sub/ $TOKEN"
curl -sS -D /tmp/sub2.hdr -o /tmp/sub2.body -A 'Happ/3.5.0' "https://svoygarage.ru/sub/${TOKEN}"
grep -iE 'HTTP/|content-type|profile-update' /tmp/sub2.hdr | head
python3 - <<'PY'
import base64, pathlib
raw=pathlib.Path('/tmp/sub2.body').read_bytes()
dec=base64.b64decode(raw).decode()
for i,l in enumerate(dec.splitlines()):
    print('L', i, l[:130])
    assert 'headerType=' not in l and 'path=' not in l and 'host=' not in l
    assert '#' in l
    assert 'encryption=none' in l
    assert 'none' + l.split('encryption=none',1)[1][:1] != 'noneR'
print('SUB_OK')
PY

echo DONE
