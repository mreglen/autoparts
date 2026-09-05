#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/settings -o /tmp/ns.json
python3 - <<'PY'
import json
from pathlib import Path
c=json.loads(Path('/tmp/ns.json').read_text())['certificate']
Path('/root/marzban-node-client.pem').write_text(c if c.endswith('\n') else c+'\n')
print('cert_len', len(c))
print('fingerprint_head', c.splitlines()[1][:40] if len(c.splitlines())>1 else '')
PY

# Push new cert to node and recreate container
sshpass -p 'vNGrzXaKqX96DrMb' scp -o StrictHostKeyChecking=accept-new \
  /root/marzban-node-client.pem root@212.102.227.25:/var/lib/marzban-node/ssl_client_cert.pem

sshpass -p 'vNGrzXaKqX96DrMb' ssh root@212.102.227.25 bash -s <<'REMOTE'
set -euo pipefail
chmod 600 /var/lib/marzban-node/ssl_client_cert.pem
cd /opt/marzban-node
docker compose down
docker compose up -d
sleep 4
docker compose logs --tail=15
ss -tulpn | grep 62050 || true
REMOTE

sleep 3
curl -s -X POST -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/1/reconnect || true
sleep 10
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool

sshpass -p 'vNGrzXaKqX96DrMb' ssh root@212.102.227.25 \
  'ss -tulpn | grep -E ":(62050|62051|8443)\s" || true; docker logs marzban-node --tail=25'
echo DONE
