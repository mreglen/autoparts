#!/usr/bin/env bash
set -euo pipefail
PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token \
  -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

echo "=== hosts ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/hosts | python3 -c '
import sys,json
d=json.load(sys.stdin)
for t,es in d.items():
  for e in es:
    print(e.get("remark"), e.get("address"), e.get("port"), e.get("sni"), "path=",repr(e.get("path")))
'

echo "=== sample links ==="
USER=$(sudo -u postgres psql -d autoparts -tAc "select marzban_username from marzvpn_users limit 1" | tr -d "[:space:]")
curl -s -H "Authorization: Bearer $TOK" "http://127.0.0.1:62050/api/user/$USER" | python3 -c '
import sys,json,urllib.parse
u=json.load(sys.stdin)
for L in u.get("links") or []:
  q=urllib.parse.parse_qs(urllib.parse.urlparse(L).query)
  hostport=L.split("@")[1].split("?")[0]
  print(hostport, "sni=", q.get("sni"), "sid=", q.get("sid"), "path=", q.get("path"), "spx=", q.get("spx"))
'

echo "=== DB ==="
sudo -u postgres psql -d autoparts -c "select telegram_id, left(subscription_url,50) sub, left(crypt4_link,55) crypt, verify_note from marzvpn_users;"

echo "=== bot marker ==="
grep -n "get_single_happ_link\|crypt5\|HAPP_CRYPTO" /opt/marzban-vpn-bot/happ_crypto.py | head || true
grep -n "КЛЮЧ HAPP\|happ://add\|vless" /opt/marzban-vpn-bot/handlers.py | head || true

echo "=== TCP 8443 ==="
timeout 3 bash -c 'echo >/dev/tcp/195.24.65.251/8443' && echo RU_8443_OK || echo RU_8443_FAIL
timeout 3 bash -c 'echo >/dev/tcp/212.102.227.25/8443' && echo DE_8443_OK || echo DE_8443_FAIL

echo "=== nginx /sub/ ==="
python3 - <<'PY'
from pathlib import Path
t=Path("/etc/nginx/sites-available/svoygarage").read_text()
i=t.find("location /sub/")
print(t[i:i+420] if i>=0 else "MISSING")
PY

echo "=== sub timing ==="
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users limit 1" | tr -d "[:space:]")
curl -sS -o /dev/null -w "https_sub http=%{http_code} time=%{time_total}s\n" -A "Happ/3.5.0" --max-time 10 "https://svoygarage.ru/sub/${TOKEN}"

echo "=== nodes ==="
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json;print([(n.get("name"),n.get("status"),n.get("address")) for n in json.load(sys.stdin)])'

systemctl is-active marzban-vpn-bot nginx
