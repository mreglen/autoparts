#!/bin/bash

# Autoparts Backend Startup Script
# Place this at /home/fast/autoparts/backend/start.sh

cd /home/fast/autoparts/backend

# Activate virtual environment
source venv/bin/activate

# Kill any existing uvicorn processes
pkill -f "uvicorn app.main:app" || true

# Wait a moment for ports to be released
sleep 2

# Start uvicorn in background with logging
nohup uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    >> /var/log/autoparts/uvicorn.log 2>&1 &

echo "Backend started on port 8000"
echo "PID: $!"
echo $! > /var/run/autoparts-backend.pid

# Wait and check if it's running
sleep 3
if ps -p $! > /dev/null; then
    echo "✓ Backend is running"
else
    echo "✗ Backend failed to start. Check logs:"
    tail -50 /var/log/autoparts/uvicorn.log
fi
