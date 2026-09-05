#!/usr/bin/env bash
set -euo pipefail
TOKEN='dGdfNzY4NjUxNzcxX2VmYmM1NCwxNzg4NjM1NjAw7tGGf8_GVQ'
echo "=== /sub/ ==="
curl -sS -D - -o /tmp/subB.bin -A 'Happ/3.5.0' --max-time 15 "https://svoygarage.ru/sub/${TOKEN}" | head -20
python3 - <<'PY'
import base64, pathlib, urllib.parse
raw=pathlib.Path('/tmp/subB.bin').read_bytes()
print('size', len(raw))
dec=base64.b64decode(raw).decode()
for i,l in enumerate(dec.splitlines()):
    print('---', i)
    print(l)
    q=urllib.parse.parse_qs(urllib.parse.urlparse(l).query)
    print('keys', sorted(q))
    print('pbk', (q.get('pbk') or [''])[0][:20], 'sid', q.get('sid'), 'sni', q.get('sni'), 'encryption', q.get('encryption'))
PY

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
echo "=== core reality ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 -c 'import sys,json;r=json.load(sys.stdin)["inbounds"][0]["streamSettings"]["realitySettings"];print({k:r.get(k) for k in ("dest","serverNames","shortIds","publicKey","fingerprint","spiderX")})'
echo "=== xray recent ==="
docker logs marzban-vpn --tail 30 2>&1 | tail -30
echo "=== tcp ==="
nc -zvw2 195.24.65.251 8443 2>&1
nc -zvw2 212.102.227.25 8443 2>&1
