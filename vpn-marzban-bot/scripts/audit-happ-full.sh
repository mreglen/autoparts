#!/usr/bin/env bash
# Full Happ / Reality /sub audit on master
set -euo pipefail

echo "========== A) /sub/ response =========="
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users limit 1" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -D /tmp/sub.hdr -o /tmp/sub.body -A "Happ/3.5.0" --max-time 15 \
  "https://svoygarage.ru/sub/${TOKEN}" || true
echo "--- headers ---"
head -40 /tmp/sub.hdr
echo "--- body meta ---"
python3 - <<'PY'
import base64, pathlib
raw=pathlib.Path('/tmp/sub.body').read_bytes()
print('size', len(raw), 'head', raw[:60])
try:
    dec=base64.b64decode(raw)
    print('b64_ok', True, 'decoded_len', len(dec))
    text=dec.decode('utf-8','replace')
    lines=[l for l in text.splitlines() if l.strip()]
    print('lines', len(lines))
    for i,l in enumerate(lines[:4]):
        print(f'L{i}', l[:140])
        if '#' in l:
            q,r=l.split('#',1)
            print('  before_hash_tail', q[-40:], 'hash_ok', True, 'remark', r[:40])
        else:
            print('  NO_HASH glue_risk_tail', l[-50:])
except Exception as e:
    print('b64_fail', e)
PY

echo "========== B) Marzban user links vs core Reality =========="
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users limit 1" | tr -d '[:space:]')
curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" > /tmp/u.json
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config > /tmp/core.json
python3 - <<'PY'
import json, urllib.parse
u=json.load(open('/tmp/u.json'))
core=json.load(open('/tmp/core.json'))
r=None
for ib in core.get('inbounds') or []:
    rr=(ib.get('streamSettings') or {}).get('realitySettings')
    if rr: r=rr; break
pub=r.get('publicKey') if r else None
# private is server-side; shortIds
sids=r.get('shortIds') if r else None
print('core.publicKey', pub)
print('core.shortIds', sids)
print('core.dest', r.get('dest') if r else None)
print('core.serverNames', r.get('serverNames') if r else None)
for L in u.get('links') or []:
    q=urllib.parse.parse_qs(urllib.parse.urlparse(L).query)
    frag=urllib.parse.urlparse(L).fragment
    print('LINK', L.split('@')[1].split('?')[0] if '@' in L else L[:40])
    print('  pbk', (q.get('pbk') or [None])[0], 'match', (q.get('pbk') or [None])[0]==pub)
    print('  sid', (q.get('sid') or [None])[0], 'in', sids, 'ok', (q.get('sid') or [None])[0] in (sids or []))
    print('  sni', q.get('sni'), 'fp', q.get('fp'), 'flow', q.get('flow'), 'security', q.get('security'))
    print('  empty_params', [k for k,vs in q.items() if vs==[''] or vs==[]])
    print('  fragment', frag[:60] if frag else None)
    # glue check
    if 'encryption=none' in L and '#encryption' not in L:
        idx=L.find('encryption=none')
        after=L[idx+len('encryption=none'):idx+len('encryption=none')+1]
        print('  after_encryption_none', repr(after))
PY

echo "========== C) bot crypt4 in DB =========="
cd /opt/marzban-vpn-bot
sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, asyncpg, os, json, base64
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
from happ_crypto import build_happ_crypt4, normalize_vless_for_happ, is_real_happ_crypto_link
DSN=os.getenv('DATABASE_URL','').replace('postgresql+asyncpg://','postgresql://')
async def main():
    conn=await asyncpg.connect(DSN)
    row=await conn.fetchrow('select crypt4_link, subscription_url from marzvpn_users limit 1')
    link=row['crypt4_link']
    print('valid', is_real_happ_crypto_link(link))
    print('crypt_head', link[:60])
    pad='='*(-len(link.split('/',3)[-1])%4)
    data=json.loads(base64.urlsafe_b64decode(link.split('/',3)[-1]+pad))
    for c in data.get('configs') or []:
        print('CFG', c[:160])
        if 'encryption=none' in c:
            i=c.index('encryption=none')
            print('  after', repr(c[i+len('encryption=none'):i+len('encryption=none')+5]))
        print('  hash_ok', '#' in c)
    await conn.close()
asyncio.run(main())
PY

echo "========== D) ports / docker / firewall =========="
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}' | grep -i marz || true
ss -tulpn | grep -E ':(8443|62050|443)\s' || true
ufw status 2>/dev/null | head -20 || true
echo "nc self/de:"
nc -zvw3 127.0.0.1 8443 2>&1 || true
nc -zvw3 195.24.65.251 8443 2>&1 || true
nc -zvw3 212.102.227.25 8443 2>&1 || true
echo "nodes:"
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json;print([(n.get("name"),n.get("status"),n.get("address")) for n in json.load(sys.stdin)])'

echo "========== E) nginx /sub/ block =========="
python3 - <<'PY'
from pathlib import Path
t=Path('/etc/nginx/sites-available/svoygarage').read_text()
i=t.find('location /sub/')
print(t[i:i+550] if i>=0 else 'MISSING location /sub/')
PY
