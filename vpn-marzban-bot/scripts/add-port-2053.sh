#!/bin/bash
# Add Reality inbound on 2053 (fallback if mobile ISP blocks 8443).
set -euo pipefail
cd /opt/marzban-vpn
TOKEN=$(docker compose exec -T marzban python3 - <<'PY'
from marzban import crud
from marzban.db import GetDB
from marzban.models.admin import AdminCreate
from marzban.utils.auth import create_admin_token
with GetDB() as db:
    admin = crud.get_admin(db, "admin") or crud.create_admin(db, AdminCreate(username="admin", password="admin", is_sudo=True))
    print(create_admin_token(admin.username, admin.is_sudo)["access_token"])
PY
)

python3 - <<PY
import json, urllib.request
TOKEN = """$TOKEN""".strip()

def api(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:62050{path}",
        data=data,
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())

cfg = api("GET", "/api/core/config")
pbk = open("/root/marzban-vpn-reality-public.key").read().strip()
sid = open("/root/marzban-vpn-reality-shortid.txt").read().strip()
priv = open("/root/marzban-vpn-reality-private.key").read().strip()

inbounds = cfg.get("inbounds") or []
if any(i.get("port") == 2053 for i in inbounds):
    print("inbound 2053 already exists")
else:
    inbounds.append({
        "tag": "VLESS TCP REALITY 2053",
        "listen": "0.0.0.0",
        "port": 2053,
        "protocol": "vless",
        "settings": {"clients": [], "decryption": "none"},
        "streamSettings": {
            "network": "tcp",
            "security": "reality",
            "realitySettings": {
                "show": False,
                "dest": "www.apple.com:443",
                "xver": 0,
                "serverNames": ["www.apple.com", "apple.com"],
                "privateKey": priv,
                "shortIds": [sid],
            },
            "tcpSettings": {"header": {"type": "none"}},
        },
        "sniffing": {"enabled": True, "destOverride": ["http", "tls", "quic"]},
    })
    cfg["inbounds"] = inbounds
    api("PUT", "/api/core/config", cfg)
    print("added inbound 2053")

hosts = api("GET", "/api/hosts")
need = [
    ("VLESS TCP REALITY 2053", "195.24.65.251", "Russia 2053"),
    ("VLESS TCP REALITY 2053", "212.102.227.25", "Germany 2053"),
]
for inbound_tag, address, remark in need:
    key = f"{inbound_tag}::{address}"
    exists = False
    for k, arr in (hosts or {}).items():
        for h in arr or []:
            if h.get("address") == address and inbound_tag in k:
                exists = True
    if exists:
        print("host exists", remark)
        continue
    hosts.setdefault(inbound_tag, []).append({
        "remark": remark,
        "address": address,
        "port": 2053,
        "sni": "www.apple.com",
        "host": "",
        "path": "",
        "security": "reality",
        "alpn": "",
        "fingerprint": "chrome",
        "allowinsecure": False,
        "is_disabled": False,
        "mux_enable": False,
        "fragment_setting": "",
        "noise_setting": "",
        "random_user_agent": False,
        "use_sni_as_host": False,
    })
    print("added host", remark)

api("PUT", "/api/hosts", hosts)
print("hosts updated")

# Enable 2053 inbound for our user
user = api("GET", "/api/user/tg_768651771_efbc54")
inbounds = user.get("inbounds") or {}
vless = set(inbounds.get("vless") or [])
vless.add("VLESS TCP REALITY")
vless.add("VLESS TCP REALITY 2053")
user["inbounds"] = {"vless": sorted(vless)}
# keep proxies
api("PUT", f"/api/user/{user['username']}", {
    "proxies": user.get("proxies") or {"vless": {"flow": "xtls-rprx-vision"}},
    "inbounds": user["inbounds"],
    "expire": user.get("expire"),
    "data_limit": user.get("data_limit"),
    "data_limit_reset_strategy": user.get("data_limit_reset_strategy") or "no_reset",
    "status": "active",
    "note": user.get("note") or "",
    "on_hold_timeout": user.get("on_hold_timeout"),
    "on_hold_expire_duration": user.get("on_hold_expire_duration"),
})
print("user inbounds:", user["inbounds"])
PY

ufw allow 2053/tcp >/dev/null 2>&1 || true
# also open on germany node if we can
sshpass -p 'vNGrzXaKqX96DrMb' ssh -o StrictHostKeyChecking=no root@212.102.227.25 'ufw allow 2053/tcp >/dev/null 2>&1; ss -lntp | grep 2053 || echo DE_NO_2053_YET' || true
sleep 3
ss -lntp | grep 2053 || echo MASTER_NO_2053
