#!/usr/bin/env bash
set -euo pipefail

echo "=== Marzban ports ==="
ss -tulpn | grep -E '62050|8000|8080|2086|8443' || true
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}' | grep -i marz || true

echo "=== current /sub/ nginx ==="
grep -n "location.*/sub" -n /etc/nginx/sites-available/svoygarage | head
python3 - <<'PY'
from pathlib import Path
t=Path('/etc/nginx/sites-available/svoygarage').read_text()
i=t.find('location ^~ /sub/')
print(t[i:i+450] if i>=0 else 'MISSING')
PY

TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users order by created_at desc limit 1" | tr -d '[:space:]' || true)
echo "TOKEN=${TOKEN:0:40}"

if [[ -n "${TOKEN}" ]]; then
  echo "=== timing public sub ==="
  curl -sS -o /tmp/sub.bin -w "http=%{http_code} time=%{time_total}s size=%{size_download} ctype=%{content_type}\n" \
    -A "Happ/3.5.0" "https://svoygarage.ru/sub/${TOKEN}" || true
  head -c 40 /tmp/sub.bin; echo
fi

PASS=$(cat /root/marzban-vpn-admin.pass)
TOK=$(curl -s -X POST http://127.0.0.1:62050/api/admin/token -d "username=admin" -d "password=${PASS}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/nodes | python3 -c 'import sys,json;print([(n.get("name"),n.get("status"),n.get("address")) for n in json.load(sys.stdin)])'
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/hosts | python3 -c 'import sys,json;d=json.load(sys.stdin);
for t,es in d.items():
  for e in es: print(e.get("remark"), e.get("address"), e.get("port"), e.get("sni"), "path=",repr(e.get("path")))'
curl -s -H "Authorization: Bearer $TOK" http://127.0.0.1:62050/api/core/config | python3 -c 'import sys,json;r=json.load(sys.stdin)["inbounds"][0]["streamSettings"]["realitySettings"];print({k:r.get(k) for k in ("dest","serverNames","shortIds","fingerprint","spiderX","publicKey")})'
