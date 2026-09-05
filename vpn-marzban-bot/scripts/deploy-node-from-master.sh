#!/bin/bash
set -euo pipefail
# Copy bundle from master to node and install Marzban Node
NODE_IP=212.102.227.25
NODE_PASS='vNGrzXaKqX96DrMb'

sshpass -p "$NODE_PASS" scp -o StrictHostKeyChecking=accept-new -r \
  /root/marzban-node-bundle root@${NODE_IP}:/root/

sshpass -p "$NODE_PASS" ssh -o StrictHostKeyChecking=accept-new root@${NODE_IP} bash -s <<'REMOTE'
set -euo pipefail
cd /root/marzban-node-bundle
sed -i 's/\r$//' install-node.sh docker-compose.yml || true
chmod +x install-node.sh
bash install-node.sh /root/marzban-node-bundle/ssl_client_cert.pem
echo '--- status ---'
ss -tulpn | grep -E ':(62050|62051|8443)\s' || true
docker ps --filter name=marzban-node
REMOTE

echo DONE_INSTALL
