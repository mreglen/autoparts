#!/bin/bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:62050/docs || true)
  [[ "$code" != "000" ]] && break
  sleep 2
done
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

python3 - <<PY
import json, urllib.request, urllib.error, os
token = """${TOKEN}"""

# Hosts
hosts = {
  "VLESS TCP REALITY": [
    {
      "remark": "🇷🇺 Russia | VLESS-Reality",
      "address": "195.24.65.251",
      "port": 8443,
      "sni": "www.microsoft.com",
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
      "sni": "www.microsoft.com",
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

# Nodes
reqn = urllib.request.Request(
  "http://127.0.0.1:62050/api/nodes",
  headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(reqn, timeout=30) as resp:
  nodes = json.load(resp)
print("nodes_before", nodes)

if not any(n.get("address")=="212.102.227.25" for n in (nodes or [])):
  body = {
    "name": "Germany",
    "address": "212.102.227.25",
    "port": 62050,
    "api_port": 62051,
    "usage_coefficient": 1.0,
    "add_as_new_host": False,
  }
  reqc = urllib.request.Request(
    "http://127.0.0.1:62050/api/node",
    data=json.dumps(body).encode(),
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    method="POST",
  )
  with urllib.request.urlopen(reqc, timeout=60) as resp:
    print("node_created", resp.read().decode()[:300])
else:
  nid = next(n["id"] for n in nodes if n.get("address")=="212.102.227.25")
  reqr = urllib.request.Request(
    f"http://127.0.0.1:62050/api/node/{nid}/reconnect",
    headers={"Authorization": f"Bearer {token}"},
    method="POST",
  )
  with urllib.request.urlopen(reqr, timeout=30) as resp:
    print("reconnected", resp.read().decode())

import time
time.sleep(6)
with urllib.request.urlopen(reqn, timeout=30) as resp:
  print("nodes_after", resp.read().decode()[:500])

# Fresh user
import secrets
uname = "tgfix" + secrets.token_hex(3)
body = {
  "username": uname,
  "proxies": {"vless": {"flow": "xtls-rprx-vision"}},
  "inbounds": {"vless": ["VLESS TCP REALITY"]},
  "expire": 0,
  "data_limit": 0,
  "status": "active",
}
requ = urllib.request.Request(
  "http://127.0.0.1:62050/api/user",
  data=json.dumps(body).encode(),
  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
  method="POST",
)
with urllib.request.urlopen(requ, timeout=30) as resp:
  d = json.load(resp)
print("user", d["username"])
sub = (d.get("subscription_url") or "").replace(":62050", ":2086")
print("SUB", sub)
for l in d.get("links") or []:
  print("LINK_OK" if "sid=e0407c966b24646b" in l else "LINK_BAD", l[:100])
import urllib.request as u, base64
raw = u.urlopen(sub, timeout=20).read()
text = base64.b64decode(raw).decode()
from urllib.parse import unquote
print("PUBLIC_SUB_COUNT", len([x for x in text.splitlines() if x.startswith("vless")]))
for line in text.splitlines():
  if "#" in line:
    print("CFG", unquote(line.rsplit("#",1)[-1]))
PY

systemctl is-active marzban-vpn-bot
echo DONE
