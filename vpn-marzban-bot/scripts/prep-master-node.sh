#!/bin/bash
set -euo pipefail

PASS=$(cat /root/marzban-vpn-admin.pass)
TOKEN=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "username=admin&password=${PASS}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')
echo "token_ok=${#TOKEN}"

curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/node/settings -o /tmp/node-settings.json
python3 - <<'PY'
import json
from pathlib import Path
d = json.loads(Path("/tmp/node-settings.json").read_text())
c = d.get("certificate") or ""
path = Path("/root/marzban-node-client.pem")
path.write_text(c if c.endswith("\n") else c + "\n", encoding="utf-8")
print("cert_len", len(c))
print("saved", path)
print(c[:60].replace("\n", "\\n"))
PY

curl -s -H "Authorization: Bearer ${TOKEN}" http://127.0.0.1:62050/api/hosts -o /tmp/hosts-before.json
python3 -m json.tool /tmp/hosts-before.json | head -n 60

export TOKEN
python3 - <<'PY'
import json, os, urllib.request, urllib.error
from pathlib import Path

token = os.environ["TOKEN"]
inbound = "VLESS TCP REALITY"

req = urllib.request.Request(
    "http://127.0.0.1:62050/api/hosts",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(req, timeout=30) as resp:
    current = json.load(resp)

hosts = dict(current)
hosts[inbound] = [
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

req2 = urllib.request.Request(
    "http://127.0.0.1:62050/api/hosts",
    data=json.dumps(hosts).encode(),
    headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    },
    method="PUT",
)
with urllib.request.urlopen(req2, timeout=30) as resp:
    print("hosts_status", resp.status)
    print(resp.read()[:900].decode())

# Register node if missing
reqn = urllib.request.Request(
    "http://127.0.0.1:62050/api/nodes",
    headers={"Authorization": f"Bearer {token}"},
)
with urllib.request.urlopen(reqn, timeout=30) as resp:
    nodes = json.load(resp)
print("nodes_before", nodes)

exists = any(
    (n.get("address") == "212.102.227.25") or (n.get("name") == "Germany")
    for n in (nodes or [])
)
if exists:
    print("node_already_registered")
else:
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
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(reqc, timeout=60) as resp:
            print("node_created", resp.read().decode()[:500])
    except urllib.error.HTTPError as e:
        print("node_create_error", e.code, e.read().decode()[:500])

with urllib.request.urlopen(reqn, timeout=30) as resp:
    print("nodes_after", resp.read().decode()[:800])
PY

# Try install sshpass and connect to node with common password (may fail)
echo "==> Try SSH to node from master"
if ! command -v sshpass >/dev/null 2>&1; then
  apt-get install -y -qq sshpass >/dev/null || true
fi
if command -v sshpass >/dev/null 2>&1; then
  if sshpass -p 'Vfcnthparol123!' ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 root@212.102.227.25 'uname -a' 2>/tmp/node-ssh.err; then
    echo NODE_SSH_OK
  else
    echo NODE_SSH_FAILED
    cat /tmp/node-ssh.err || true
  fi
else
  echo sshpass_unavailable
fi

echo DONE
