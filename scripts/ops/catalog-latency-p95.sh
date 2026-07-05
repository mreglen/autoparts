#!/usr/bin/env bash
# Sample catalog cache-miss latency and print p50/p95 (run on server).
set -euo pipefail

HOST_HDR="Host: svoygarage.ru"
BASE="https://127.0.0.1"
N="${1:-10}"
times=()

for ((i = 1; i <= N; i++)); do
  bust="${RANDOM}${i}"
  t=$(curl -s -o /dev/null -w '%{time_total}' \
    -H "$HOST_HDR" "${BASE}/server/api/catalog/products?page=1&page_size=20&_bust=${bust}" -k)
  times+=("$t")
  printf 'miss%02d:%ss\n' "$i" "$t"
done

sorted=$(printf '%s\n' "${times[@]}" | sort -n)
p50=$(echo "$sorted" | sed -n "$(( (N + 1) / 2 ))p")
p95_idx=$(( N * 95 / 100 ))
[[ "$p95_idx" -lt 1 ]] && p95_idx=1
p95=$(echo "$sorted" | sed -n "${p95_idx}p")
max=$(echo "$sorted" | tail -1)
echo "p50:${p50}s p95:${p95}s max:${max}s"
