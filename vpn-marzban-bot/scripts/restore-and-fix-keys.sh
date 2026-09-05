#!/usr/bin/env bash
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
echo "==> wait panel"
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:62050/docs || true)
  [[ "$code" != "000" ]] && break
  sleep 2
done

TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
echo "token ok"

# Restore hosts with apple SNI, empty path
python3 - "$TOKEN" <<'PY'
import json, sys, urllib.request, urllib.error
token = sys.argv[1]
hosts = {
  "VLESS TCP REALITY": [
    {
      "remark": "🇷🇺 Russia | VLESS-Reality",
      "address": "195.24.65.251",
      "port": 8443,
      "sni": "www.apple.com",
      "host": "",
      "path": "",
      "security": "inbound_default",
      "alpn": "",
      "fingerprint": "chrome",
      "allowinsecure": False,
      "is_disabled": False,
      "mux_enable": False,
      "fragment_setting": "",
      "noise_setting": "",
      "random_user_agent": False,
      "use_sni_as_host": False,
    },
    {
      "remark": "🇩🇪 Germany | VLESS-Reality",
      "address": "212.102.227.25",
      "port": 8443,
      "sni": "www.apple.com",
      "host": "",
      "path": "",
      "security": "inbound_default",
      "alpn": "",
      "fingerprint": "chrome",
      "allowinsecure": False,
      "is_disabled": False,
      "mux_enable": False,
      "fragment_setting": "",
      "noise_setting": "",
      "random_user_agent": False,
      "use_sni_as_host": False,
    },
  ]
}
req = urllib.request.Request(
  "http://127.0.0.1:62050/api/hosts",
  data=json.dumps(hosts).encode(),
  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
  method="PUT",
)
with urllib.request.urlopen(req, timeout=30) as resp:
  print("hosts", resp.status)

reqn = urllib.request.Request("http://127.0.0.1:62050/api/nodes", headers={"Authorization": f"Bearer {token}"})
nodes = json.load(urllib.request.urlopen(reqn))
print("nodes_before", [(n.get("name"), n.get("status"), n.get("address")) for n in (nodes or [])])

if not any((n.get("address")=="212.102.227.25") for n in (nodes or [])):
  body = {
    "name": "Germany",
    "address": "212.102.227.25",
    "port": 62050,
    "api_port": 62051,
    "usage_coefficient": 1.0,
    "add_as_new_host": False,
  }
  reqa = urllib.request.Request(
    "http://127.0.0.1:62050/api/node",
    data=json.dumps(body).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
  )
  try:
    with urllib.request.urlopen(reqa, timeout=60) as resp:
      print("node_add", resp.status, resp.read()[:200])
  except urllib.error.HTTPError as e:
    print("node_add_err", e.code, e.read()[:300])
else:
  print("node already registered")
PY

# Refresh node certificate from master and push to Germany
echo "==> refresh node cert"
CERT=$(curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/settings \
  | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("certificate") or d.get("cert") or "")')
if [[ -n "$CERT" ]]; then
  printf '%s\n' "$CERT" > /root/marzban-node-client.pem
  sshpass -p 'vNGrzXaKqX96DrMb' scp -o StrictHostKeyChecking=accept-new \
    /root/marzban-node-client.pem root@212.102.227.25:/var/lib/marzban-node/ssl_client_cert.pem
  sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new root@212.102.227.25 \
    'cd /opt/marzban-node && docker compose restart || docker restart marzban-node'
  sleep 5
fi

# reconnect node via API if disconnected
python3 - "$TOKEN" <<'PY'
import json, sys, urllib.request, urllib.error, time
token=sys.argv[1]
def get_nodes():
  req=urllib.request.Request('http://127.0.0.1:62050/api/nodes', headers={'Authorization':f'Bearer {token}'})
  return json.load(urllib.request.urlopen(req))
for _ in range(10):
  nodes=get_nodes()
  print([(n.get('name'), n.get('status'), n.get('id')) for n in nodes])
  for n in nodes:
    if n.get('address')=='212.102.227.25' and n.get('status')!='connected':
      nid=n.get('id')
      # try reconnect endpoint
      for path in (f'/api/node/{nid}/reconnect', f'/api/nodes/{nid}/reconnect'):
        try:
          req=urllib.request.Request(f'http://127.0.0.1:62050{path}', data=b'{}', headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'}, method='POST')
          with urllib.request.urlopen(req, timeout=30) as resp:
            print('reconnect', path, resp.status)
        except Exception as e:
          print('reconnect fail', path, e)
  time.sleep(3)
  nodes=get_nodes()
  if any(n.get('address')=='212.102.227.25' and n.get('status')=='connected' for n in nodes):
    print('Germany connected')
    break
PY

echo "==> refresh user keys (official happ crypto)"
cd /opt/marzban-vpn-bot
# sync bot code
rsync -a --delete --exclude .env --exclude .venv --exclude __pycache__ \
  /home/fast/autoparts/vpn-marzban-bot/bot/ /opt/marzban-vpn-bot/
chown -R marzbanbot:marzbanbot /opt/marzban-vpn-bot

sudo -u marzbanbot .venv/bin/python <<'PY'
import asyncio, os, re
from datetime import datetime, timezone
from dotenv import load_dotenv
load_dotenv('/opt/marzban-vpn-bot/.env')
import asyncpg, httpx
from happ_crypto import generate_happ_official_crypto, generate_happ_add_link, is_real_happ_crypto_link

BASE=os.getenv('MARZBAN_BASE_URL','http://127.0.0.1:62050').rstrip('/')
USER=os.getenv('MARZBAN_USERNAME','admin')
PASS=os.getenv('MARZBAN_PASSWORD','')
HTTPS='https://svoygarage.ru'

def to_https(url: str) -> str:
    m=re.search(r'/sub/([^?\s#]+)', url or '')
    if not m:
        raise RuntimeError(f'no /sub/ in {url!r}')
    return f"{HTTPS}/sub/{m.group(1)}"

async def main():
    db=os.environ['DATABASE_URL'].replace('postgresql+asyncpg://','postgresql://')
    conn=await asyncpg.connect(db)
    rows=await conn.fetch('select telegram_id, marzban_username from marzvpn_users')
    async with httpx.AsyncClient(timeout=40.0, follow_redirects=True) as c:
        tok=(await c.post(f'{BASE}/api/admin/token', data={'username':USER,'password':PASS})).json()['access_token']
        h={'Authorization':f'Bearer {tok}'}
        for r in rows:
            resp=await c.get(f"{BASE}/api/user/{r['marzban_username']}", headers=h)
            print('user_http', resp.status_code)
            data=resp.json()
            raw_sub=data.get('subscription_url') or ''
            print('raw_sub', raw_sub)
            sub=to_https(raw_sub)
            for link in data.get('links') or []:
                print('LINK', 'path_bad' if ('path=%2F' in link or 'path=/' in link) else 'ok', link[:140])
            probe=await c.get(sub, headers={'User-Agent':'Happ/3.5.0'})
            print('probe', probe.status_code, probe.headers.get('content-type'), len(probe.content))
            assert probe.status_code==200
            crypt=generate_happ_official_crypto(sub)
            assert is_real_happ_crypto_link(crypt)
            await conn.execute(
                '''update marzvpn_users set subscription_url=$1, crypt4_link=$2, key_valid=true,
                   verify_note=$3, last_verified_at=$4 where telegram_id=$5''',
                sub, crypt, 'restored_official_crypto', datetime.now(timezone.utc), r['telegram_id'])
            print('add', generate_happ_add_link(sub))
            print('crypt', crypt[:70], '...')
    await conn.close()
asyncio.run(main())
PY

systemctl restart marzban-vpn-bot
sleep 2
systemctl is-active marzban-vpn-bot
echo RESTORE_AND_KEYS_OK
