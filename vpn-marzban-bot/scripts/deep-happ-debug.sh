#!/usr/bin/env bash
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]')
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]')
echo "USER=$USER"
echo "TOKEN=$TOKEN"

curl -s -H "Authorization: Bearer ${TOK}" "http://127.0.0.1:62050/api/user/${USER}" > /tmp/u.json
python3 - <<'PY'
import json, urllib.parse
u=json.load(open('/tmp/u.json'))
print('status', u.get('status'), 'expire', u.get('expire'))
print('sub', u.get('subscription_url'))
for link in u.get('links') or []:
    print('LINK', link)
    q=link.split('?',1)[-1].split('#',1)[0]
    p={k:v[0] for k,v in urllib.parse.parse_qs(q).items()}
    host=link.split('@',1)[-1].split('?',1)[0]
    print(' addr', host)
    for k in ('security','type','flow','fp','pbk','sid','sni','spx','path'):
        print(f'  {k}={p.get(k)}')
PY

echo "=== public sub ==="
curl -sS -D /tmp/h.txt -o /tmp/b.bin -A "Happ/3.5.0" \
  -H "X-Device-Os: Android" -H "X-Hwid: test-hwid-001" \
  "https://svoygarage.ru/sub/${TOKEN}"
head -15 /tmp/h.txt
python3 - <<'PY'
from pathlib import Path
import base64
b=Path('/tmp/b.bin').read_bytes()
print('len', len(b))
print(base64.b64decode(b.strip()).decode()[:400])
PY

echo "=== happ crypto api ==="
SUB="https://svoygarage.ru/sub/${TOKEN}"
curl -sS -X POST "https://crypto.happ.su/api-v2.php" \
  -H "Content-Type: application/json" \
  --data-binary "{\"url\":\"${SUB}\"}" | tee /tmp/happ_api.json
echo

echo "=== ports ==="
timeout 3 bash -c 'echo >/dev/tcp/195.24.65.251/8443' && echo RU_OK || echo RU_FAIL
timeout 3 bash -c 'echo >/dev/tcp/212.102.227.25/8443' && echo DE_OK || echo DE_FAIL

curl -s -H "Authorization: Bearer ${TOK}" http://127.0.0.1:62050/api/core/config > /tmp/core.json
python3 - <<'PY'
import json
r=json.load(open('/tmp/core.json'))['inbounds'][0]['streamSettings']['realitySettings']
print('reality', {k:r.get(k) for k in ('dest','serverNames','shortIds','fingerprint','spiderX','publicKey')})
PY

curl -s -H "Authorization: Bearer ${TOK}" http://127.0.0.1:62050/api/hosts > /tmp/hosts.json
python3 -m json.tool /tmp/hosts.json | head -50
