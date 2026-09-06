#!/bin/bash
# Fix Reality: restart node, re-push core, optional SNI fallback prove, refresh bot branding.
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
PUB=$(tr -d '\r\n' </root/marzban-vpn-reality-public.key)
SID=$(tr -d '\r\n' </root/marzban-vpn-reality-shortid.txt)
PRIV=$(tr -d '\r\n' </root/marzban-vpn-reality-private.key)
SNI=dl.google.com
TAG="VLESS TCP REALITY"
DEPASS=$(cat /root/de-node.pass 2>/dev/null || echo 'vNGrzXaKqX96DrMb')

TOK=$(curl -sS -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=$PASS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# Re-PUT core to force node sync
python3 - <<PY
import json, urllib.request
TOKEN="$TOK"
PRIV="$PRIV"; SID="$SID"; SNI="$SNI"; TAG="$TAG"

def api(method, path, body=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(f"http://127.0.0.1:62050{path}", data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        raw=r.read().decode(); return json.loads(raw) if raw else {}

cfg=api("GET","/api/core/config")
for ib in cfg.get("inbounds") or []:
    if ib.get("port")==8443 or ib.get("tag")==TAG:
        ib["streamSettings"]={
            "network":"tcp",
            "security":"reality",
            "realitySettings":{
                "show": False,
                "dest": f"{SNI}:443",
                "xver": 0,
                "serverNames": [SNI, "google.com"],
                "privateKey": PRIV,
                "shortIds": [SID],
            },
            "tcpSettings":{"header":{"type":"none"}},
        }
        print("core inbound ready")
api("PUT","/api/core/config", cfg)
print("core re-pushed")

# hosts
api("PUT","/api/hosts", {TAG: [
    {"remark":"Russia","address":"195.24.65.251","port":8443,"sni":SNI,"host":"","path":"","security":"inbound_default","alpn":"","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False},
    {"remark":"Germany","address":"212.102.227.25","port":8443,"sni":SNI,"host":"","path":"","security":"inbound_default","alpn":"","fingerprint":"chrome","allowinsecure":False,"is_disabled":False,"mux_enable":False,"fragment_setting":"","noise_setting":"","random_user_agent":False,"use_sni_as_host":False},
]})
print("hosts ok")

nodes=api("GET","/api/nodes")
for n in (nodes if isinstance(nodes,list) else []):
    print("node", n.get("name"), n.get("address"), n.get("status"), n.get("message"))
    nid=n.get("id")
    if nid is not None:
        try:
            api("POST", f"/api/node/{nid}/reconnect")
            print("reconnect", nid)
        except Exception as e:
            print("reconnect_fail", e)
PY

# Restart DE node container
sshpass -p "$DEPASS" ssh -o StrictHostKeyChecking=no root@212.102.227.25 \
  'docker restart marzban-node; sleep 3; ss -lntp | grep 8443; docker logs --tail=30 marzban-node 2>&1 | tail -20' || true

sleep 8
# nodes status again
curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json; ns=json.load(sys.stdin);
[print(n.get("name"), n.get("status"), n.get("message")) for n in (ns if isinstance(ns,list) else [])]'

UUID=$(curl -sS -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/user/tg_768651771_efbc54 | python3 -c 'import sys,json;print(json.load(sys.stdin)["proxies"]["vless"]["id"])')
cd /opt/marzban-vpn
IMG=$(docker compose images -q marzban | head -1)
prove() {
  local NAME=$1 ADDR=$2 LOCAL=$3
  local CFG=/tmp/prove-fix-$NAME.json
  cat >"$CFG" <<JSON
{"log":{"loglevel":"warning"},"inbounds":[{"port":$LOCAL,"listen":"127.0.0.1","protocol":"socks","settings":{"udp":true}}],"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":"$ADDR","port":8443,"users":[{"id":"$UUID","encryption":"none","flow":"xtls-rprx-vision"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"$SNI","fingerprint":"chrome","publicKey":"$PUB","shortId":"$SID"}}}]}
JSON
  CID=$(docker run -d --rm --network host -v "$CFG:/cfg.json:ro" "$IMG" xray -c /cfg.json)
  sleep 2
  CODE=$(curl -sS -m 18 -x "socks5h://127.0.0.1:$LOCAL" -o /dev/null -w '%{http_code}' https://www.google.com/generate_204 || echo fail)
  echo "PROVE_$NAME=$CODE"
  docker stop "$CID" >/dev/null 2>&1 || true
}
prove RU 195.24.65.251 18601
prove DE 212.102.227.25 18602

# Ensure sub-proxy branding MarzVPN + restart
systemctl restart marzban-sub-proxy
sleep 1
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
curl -sSI -A Happ/3 "https://svoygarage.ru/sub/$TOKEN" | tr -d '\r' | grep -iE 'profile-title|support'
curl -sS -A Happ/3 "https://svoygarage.ru/sub/$TOKEN" | python3 -c 'import sys,base64;t=sys.stdin.read().strip();
d=base64.b64decode(t).decode(); print(d); assert "reality" in d and "184b594b7dab462a" in d'
echo DONE
