#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
AUTH="Authorization: Bearer ${TOK}"

echo "=== CORE CONFIG RAW ==="
curl -s -w "\nHTTP=%{http_code}\n" -H "$AUTH" http://127.0.0.1:62050/api/core/config | head -c 500
echo
# try alternate
for p in /api/core /api/system /api/core/config/; do
  code=$(curl -s -o /tmp/c.json -w '%{http_code}' -H "$AUTH" "http://127.0.0.1:62050${p}")
  echo "try $p -> $code size=$(wc -c </tmp/c.json)"
done

echo "=== XRAY FILE ON DISK ==="
find /var/lib/marzban-vpn /opt/marzban-vpn -name 'xray*' 2>/dev/null | head
CFG=$(find /var/lib/marzban-vpn -name 'xray_config.json' 2>/dev/null | head -1)
echo "CFG=$CFG"
if [[ -n "$CFG" ]]; then
  python3 - "$CFG" <<'PY'
import json,sys
cfg=json.load(open(sys.argv[1]))
for ib in cfg.get('inbounds',[]):
  s=ib.get('streamSettings') or {}
  r=s.get('realitySettings') or {}
  print('tag', ib.get('tag'), 'port', ib.get('port'))
  print('security', s.get('security'))
  print('dest', r.get('dest'))
  print('serverNames', r.get('serverNames'))
  print('shortIds', r.get('shortIds'))
  print('privateKey_set', bool(r.get('privateKey')))
  print('publicKey', (r.get('publicKey') or '')[:60])
  print('fingerprint', r.get('fingerprint'))
  print('spiderX', r.get('spiderX'))
PY
fi

echo "=== KEY FILES ==="
echo -n "pubfile="; cat /root/marzban-vpn-reality-public.key; echo
echo -n "sidfile="; cat /root/marzban-vpn-reality-shortid.txt; echo
echo -n "privfile="; wc -c /root/marzban-vpn-reality-private.key

echo "=== USER LINKS ==="
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users order by created_at desc limit 1")
echo "user=$USER"
curl -s -H "$AUTH" "http://127.0.0.1:62050/api/user/${USER}" > /tmp/user.json
python3 <<'PY'
import json, urllib.parse, base64, urllib.request
u=json.load(open('/tmp/user.json'))
print('status', u.get('status'))
print('sub', u.get('subscription_url'))
for link in u.get('links') or []:
    print('LINK', link)
    if not link.startswith('vless://'):
        continue
    main, frag = link.split('#',1) if '#' in link else (link, '')
    q = main.split('?',1)[1] if '?' in main else ''
    params = {k:v[0] for k,v in urllib.parse.parse_qs(q).items()}
    host = main.split('@',1)[1].split('?',1)[0]
    print('  addr', host)
    for k in ('security','encryption','type','flow','fp','pbk','sid','sni','spx','pqv','headerType'):
        print(f'  {k}={params.get(k)}')
    print('  remark', urllib.parse.unquote(frag))
# fetch sub
sub = (u.get('subscription_url') or '').replace(':62050',':2086')
body = urllib.request.urlopen(sub, timeout=10).read()
print('sub_len', len(body))
text = body.decode(errors='replace').strip()
if not text.startswith('vless://'):
    try:
        text = base64.b64decode(text).decode()
        print('decoded b64')
    except Exception as e:
        print('b64 fail', e)
for line in text.splitlines():
    if line.startswith('vless://'):
        print('SUB', line[:220])
PY

echo "=== PORT 8443 LISTEN / CONNECT ==="
ss -tulpn | grep 8443 || true
timeout 3 bash -c 'echo > /dev/tcp/127.0.0.1/8443' && echo local8443_ok || echo local8443_fail
timeout 3 bash -c 'echo > /dev/tcp/195.24.65.251/8443' && echo pub8443_ok || echo pub8443_fail
timeout 3 bash -c 'echo > /dev/tcp/212.102.227.25/8443' && echo de8443_ok || echo de8443_fail

echo "=== DOCKER LOGS ==="
docker logs marzban-vpn --tail 30 2>&1 | tail -30
