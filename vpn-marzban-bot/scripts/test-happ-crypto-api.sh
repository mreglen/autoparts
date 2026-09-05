#!/bin/bash
set -euo pipefail
URL="${1:-http://195.24.65.251:2086/sub/test}"
curl -sS -X POST "https://crypto.happ.su/api-v2.php" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${URL}\"}"
echo
