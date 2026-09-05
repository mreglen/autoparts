#!/bin/bash
# Audit Germany Marzban-node Reality keys vs master
set -euo pipefail
echo "========== DE NODE AUDIT $(date -Is) =========="
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' | head -20
echo "=== node logs ==="
for c in $(docker ps --format '{{.Names}}' | grep -iE 'marzban|node|xray' || true); do
  echo "--- logs $c ---"
  docker logs --tail 80 "$c" 2>&1 | grep -iE 'reality|rejected|invalid|failed|certificate|handshak|error' | tail -30 || true
done
echo "=== find xray configs ==="
find /var/lib /opt /etc -name 'xray*.json' 2>/dev/null | head -20
for f in $(find /var/lib /opt -name 'xray_config.json' 2>/dev/null | head -5); do
  echo "=== $f ==="
  python3 - <<PY
import json
from pathlib import Path
c=json.loads(Path("$f").read_text())
for ib in c.get("inbounds",[]):
    ss=ib.get("streamSettings") or {}
    rs=ss.get("realitySettings") or {}
    if not rs: continue
    print(ib.get("tag"), ib.get("port"))
    print(" privateKey", (rs.get("privateKey") or "")[:24]+"...")
    print(" shortIds", rs.get("shortIds"))
    print(" serverNames", rs.get("serverNames"))
    print(" dest", rs.get("dest"))
    ids=[cl.get("id") for cl in (ib.get("settings") or {}).get("clients") or []]
    print(" has_uuid", "ccc7e71d-743a-499a-b5b7-f1a484368b7d" in ids, "clients", len(ids))
PY
done
ss -lntp | grep 8443 || echo 'NO_8443_LISTEN'
nc -zvw2 127.0.0.1 8443 2>&1 | tail -1 || true
