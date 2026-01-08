#!/bin/bash
# Quick fix for CORS and file size issues

echo "=== Quick Server Fix ==="

# Go to backend directory
cd "$(dirname "$0")"

# Kill existing processes
pkill -f uvicorn
sleep 2

# Start FastAPI with increased limits
echo "Starting FastAPI with increased limits..."
uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 2 \
    --limit-concurrency 100 \
    --limit-max-requests 1000 \
    --backlog 2048 \
    --timeout-keep-alive 300 \
    --access-log \
    --log-level info &

echo "FastAPI started. PID: $!"

# Wait and test
sleep 3

# Test CORS
echo -e "\n=== Testing CORS ==="
curl -H "Origin: http://vm2512296768.vds.ru" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:8000/api/upload/photo \
     -v 2>&1 | grep -E "(Access-Control|HTTP|Content-Type)" | head -10

echo -e "\n=== Server should now work with large files and CORS ==="
