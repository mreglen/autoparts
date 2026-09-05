#!/usr/bin/env bash
set -euo pipefail

echo "=== DB URL / crypt ==="
sudo -u postgres psql -d autoparts -c \
  "select telegram_id, subscription_url, crypt4_link from marzvpn_users;"

TOKEN=$(sudo -u postgres psql -d autoparts -tAc \
  "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"

echo "=== HTTPS fetch with headers ==="
curl -sS -D /tmp/sub_hdrs.txt -o /tmp/sub_body.bin \
  -A "Happ/3.0" \
  "https://svoygarage.ru/sub/${TOKEN}" || true
echo "--- response headers ---"
cat /tmp/sub_hdrs.txt
echo "--- body meta ---"
python3 - <<'PY'
from pathlib import Path
b = Path('/tmp/sub_body.bin').read_bytes()
print('len', len(b))
print('head_raw', b[:120])
text = b.decode('utf-8', errors='replace').strip()
print('startswith_html', text.lower().startswith('<!doctype') or text.lower().startswith('<html'))
print('startswith_vless', text.startswith('vless://'))
import base64
try:
    dec = base64.b64decode(text)
    dtext = dec.decode('utf-8', errors='replace')
    print('b64_ok', True, 'decoded_len', len(dec))
    print('decoded_head', dtext[:200].replace('\n',' | '))
    print('vless_lines', sum(1 for x in dtext.splitlines() if x.startswith('vless://')))
except Exception as e:
    print('b64_fail', e)
PY

echo "=== localhost panel direct ==="
curl -sS -D - -o /tmp/sub_local.bin -A "Happ/3.0" \
  "http://127.0.0.1:62050/sub/${TOKEN}" | head -30
python3 - <<'PY'
from pathlib import Path
b=Path('/tmp/sub_local.bin').read_bytes()
print('local_len', len(b), 'head', b[:80])
PY

echo "=== nginx /sub/ blocks ==="
grep -n "location.*/sub" -n /etc/nginx/sites-enabled/svoygarage /etc/nginx/sites-enabled/marzban-sub || true
sed -n '1,80p' /etc/nginx/sites-enabled/marzban-sub
# show context around /sub in svoygarage
python3 - <<'PY'
from pathlib import Path
t=Path('/etc/nginx/sites-enabled/svoygarage').read_text()
i=t.find('location ^~ /sub/')
print('idx', i)
print(t[i:i+500] if i>=0 else 'NOT FOUND')
# also check if another location catches /sub first
for line in t.splitlines():
    if 'location' in line and 'sub' in line:
        print('LOC', line)
PY

echo "=== crypt4 roundtrip ==="
cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import os, base64, json
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, asyncio
from happ_crypto import generate_valid_happ_link, decode_happ_crypt4, is_real_happ_crypto_link

async def main():
    db=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')
    conn=await asyncpg.connect(db)
    row=await conn.fetchrow('select subscription_url, crypt4_link from marzvpn_users limit 1')
    sub=row['subscription_url']
    crypt=row['crypt4_link']
    print('sub', sub)
    print('crypt_db', crypt)
    print('valid_fn', is_real_happ_crypto_link(crypt))
    print('decoded', decode_happ_crypt4(crypt))
    fresh=generate_valid_happ_link(sub)
    print('fresh', fresh)
    print('match', fresh==crypt)
    # exact algorithm from user
    payload={"url": sub.strip()}
    b64=base64.b64encode(json.dumps(payload, separators=(',',':')).encode()).decode()
    expect=f"happ://crypt4/{b64}"
    print('expect_eq_fresh', expect==fresh)
    await conn.close()
asyncio.run(main())
PY
