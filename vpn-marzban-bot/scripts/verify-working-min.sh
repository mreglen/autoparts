#!/usr/bin/env bash
set -euo pipefail
systemctl is-active marzban-vpn-bot marzban-sub-proxy
sudo -u postgres psql -d autoparts -c "select telegram_id, verify_note, left(crypt4_link,60) k from marzvpn_users;"
TOKEN=$(sudo -u postgres psql -d autoparts -tAc "select split_part(subscription_url,'/sub/',2) from marzvpn_users where telegram_id=768651771" | tr -d '[:space:]')
echo "TOKEN=$TOKEN"
curl -sS -o /tmp/s.bin -w "http=%{http_code}\n" -A "Happ/3.5.0" "https://svoygarage.ru/sub/${TOKEN}"
python3 - <<'PY'
import base64
print(base64.b64decode(open('/tmp/s.bin','rb').read()).decode())
PY
# client prove
python3 - <<'PY'
import json, urllib.parse, base64
dec=base64.b64decode(open('/tmp/s.bin','rb').read()).decode().splitlines()[0]
u=urllib.parse.urlparse(dec); q=dict(urllib.parse.parse_qsl(u.query))
assert q.get('sid')=='e0407c966b24646b'
uuid, hp=u.netloc.split('@'); host,port=hp.rsplit(':',1)
cfg={"log":{"loglevel":"warning"},"inbounds":[{"listen":"127.0.0.1","port":18080,"protocol":"http"}],
"outbounds":[{"protocol":"vless","settings":{"vnext":[{"address":host,"port":int(port),"users":[{"id":uuid,"encryption":"none","flow":q.get("flow","")}]}]},
"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":q["sni"],"fingerprint":q.get("fp","chrome"),"publicKey":q["pbk"],"shortId":q["sid"],"spiderX":"/"}}}]}
json.dump(cfg, open('/tmp/xray-client.json','w'))
print('client ready sid', q['sid'])
PY
docker rm -f xray-test-client >/dev/null 2>&1 || true
docker run -d --name xray-test-client --network host -v /tmp/xray-client.json:/etc/xray/config.json:ro teddysun/xray:latest >/dev/null
sleep 3
curl -sS -o /dev/null -w "proxy_google=%{http_code} t=%{time_total}\n" --connect-timeout 15 --max-time 25 -x http://127.0.0.1:18080 https://www.google.com/generate_204 || echo PROXY_FAIL
docker logs xray-test-client 2>&1 | tail -10 || true
docker rm -f xray-test-client >/dev/null 2>&1 || true
