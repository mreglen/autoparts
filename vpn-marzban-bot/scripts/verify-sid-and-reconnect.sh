#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

# Wait panel
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:62050/docs || true)
  [[ "$code" == "200" || "$code" == "404" ]] && break
  sleep 2
done

echo "==> Reality shortIds in xray_config"
python3 - <<'PY'
import json
from pathlib import Path
cfg=json.loads(Path('/var/lib/marzban-vpn/xray_config.json').read_text())
rs=cfg['inbounds'][0]['streamSettings']['realitySettings']
print('shortIds', rs.get('shortIds'))
print('privateKey_prefix', (rs.get('privateKey') or '')[:8])
Path('/tmp/sid.txt').write_text((rs.get('shortIds') or [''])[0])
PY
SID=$(cat /tmp/sid.txt)
PUB=$(cat /root/marzban-vpn-reality-public.key 2>/dev/null || true)
echo "SID=$SID PUB=$PUB"

# Reconnect node
curl -s -X POST -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/1/reconnect || true
sleep 6
curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/nodes | python3 -m json.tool

# Create fresh user to verify links include sid and both hosts
UNAME="happfix$(openssl rand -hex 2)"
python3 - <<PY
import json, os, urllib.request, time
token = """${TOKEN}"""
uname = """${UNAME}"""
body = {
  "username": uname,
  "proxies": {"vless": {"flow": "xtls-rprx-vision"}},
  "inbounds": {"vless": ["VLESS TCP REALITY"]},
  "expire": 0,
  "data_limit": 0,
  "status": "active",
}
req = urllib.request.Request(
  "http://127.0.0.1:62050/api/user",
  data=json.dumps(body).encode(),
  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
  method="POST",
)
with urllib.request.urlopen(req, timeout=30) as resp:
  d = json.load(resp)
print("user", d.get("username"))
print("SUB", d.get("subscription_url"))
for l in d.get("links") or []:
  print("LINK", l)
  assert "sid=" in l and "sid=#" not in l and "sid=&" not in l, f"bad sid in {l}"
  assert "212.102.227.25" in l or "195.24.65.251" in l
print("LINKS_OK")

# Fetch public subscription
sub = d.get("subscription_url","").replace(":62050/", ":2086/")
import urllib.request as u
raw = u.urlopen(sub, timeout=20).read()
import base64
try:
  text = base64.b64decode(raw).decode()
except Exception:
  text = raw.decode()
print("SUB_CFGS", len([x for x in text.splitlines() if x.startswith("vless://")]))
for line in text.splitlines():
  if "#" in line:
    from urllib.parse import unquote
    print("CFG", unquote(line.rsplit("#",1)[-1]))
PY

# Ensure node 8443 up
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=accept-new root@212.102.227.25 \
  'ss -tulpn | grep 8443 || true; docker ps --filter name=marzban-node --format "{{.Status}}"'

systemctl is-active marzban-vpn-bot
journalctl -u marzban-vpn-bot -n 8 --no-pager
echo DONE
