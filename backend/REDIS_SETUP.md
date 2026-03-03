# Redis Setup Guide

## ❗ IMPORTANT: Redis Must Be Running

The Celery error "'NoneType' object has no attribute 'Redis'" occurs because **Redis server is not running**.

## Quick Fix

### Option 1: Start Redis Server (Windows)

1. **Download Redis for Windows** (if not already installed):
   - Go to: https://github.com/microsoftarchive/redis/releases
   - Download: `Redis-x64-3.0.504.msi`
   - Install it

2. **Start Redis Server**:
   ```powershell
   # Navigate to Redis installation folder
   cd "C:\Program Files\Redis"
   
   # Start Redis server
   redis-server.exe
   ```

3. **Verify Redis is Running**:
   Open another terminal and run:
   ```powershell
   redis-cli ping
   ```
   Should return: `PONG`

### Option 2: Use Docker (Alternative)

If you have Docker installed:
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

### Option 3: WSL (Windows Subsystem for Linux)

```bash
# In WSL terminal
sudo service redis-server start
```

## After Starting Redis

1. **Verify it's running**:
   ```bash
   python test_redis.py
   ```
   Should show: ✅ Redis is working correctly!

2. **Restart your backend server**

3. **Start Celery worker**:
   ```bash
   celery -A app.celery_app worker --loglevel=info --pool=solo
   ```

4. **Test photo upload again**

## Checking if Redis is Already Installed

```bash
# Check if redis-server exists
where redis-server

# Or check in common locations
Test-Path "C:\Program Files\Redis\redis-server.exe"
```

## Common Issues

### Port 6379 Already in Use
Another application might be using port 6379. Check with:
```bash
netstat -ano | findstr :6379
```

### Firewall Blocking
Windows Firewall might block Redis. Allow it through firewall.

### Redis Service Not Starting
Try running as Administrator or check logs in Redis installation folder.

## Testing Complete Setup

After Redis is running:

1. ✅ Test Redis: `python test_redis.py`
2. ✅ Start backend: `uvicorn app.main:app --reload`
3. ✅ Start Celery worker: `celery -A app.celery_app worker --loglevel=info --pool=solo`
4. ✅ Upload a photo via frontend

All components should now work together!
