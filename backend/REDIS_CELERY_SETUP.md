# Redis & Celery Setup Guide

## Installation and Configuration for Ubuntu Server

This guide covers the complete setup of Redis and Celery for the Autoparts project.

---

## 1. Redis Installation

### Install Redis on Ubuntu

```bash
# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Verify installation
redis-server --version
```

---

## 2. Redis Configuration

### Edit Redis Configuration File

```bash
# Open Redis configuration file
sudo nano /etc/redis/redis.conf
```

### Key Configuration Settings

Find and modify these settings in `/etc/redis/redis.conf`:

```conf
# Network settings
bind 127.0.0.1
port 6379

# Security - Set password (IMPORTANT!)
requirepass Vfcnthredis1!

# Persistence - Enable RDB snapshots
save 900 1
save 300 10
save 60 10000

# Memory management
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Daemonize
supervised systemd
```

### Restart Redis Service

```bash
sudo systemctl restart redis-server
```

---

## 3. Verify Redis Status

### Check Redis Service Status

```bash
# Check systemd status
sudo systemctl status redis-server

# Expected output:
# ● redis-server.service - Advanced key-value store
#      Loaded: loaded (/usr/lib/systemd/system/redis-server.service; enabled; preset: enabled)
#      Active: active (running)
```

### Test Redis Connection

```bash
# Connect to Redis CLI with password
redis-cli -a Vfcnthredis1!

# Run ping command
ping
# Expected response: PONG

# Check info
info

# Exit
exit
```

### Alternative: Test without CLI

```bash
# Ping Redis server
redis-cli -a Vfcnthredis1! ping

# Get Redis info
redis-cli -a Vfcnthredis1! info server
```

---

## 4. Backend Environment Configuration

### Edit `.env` File

Open `backend/.env` and add/update Redis configuration:

```env
# Redis/Celery configuration
REDIS_URL=redis://:Vfcnthredis1!@localhost:6379/0
CELERY_BROKER_URL=redis://:Vfcnthredis1!@localhost:6379/0
CELERY_RESULT_BACKEND=redis://:Vfcnthredis1!@localhost:6379/0
```

### URL Format Explanation

```
redis://[:password]@host:port/db_number
```

- `redis://` - Protocol
- `:Vfcnthredis1!` - Password (note the colon before password)
- `localhost` - Redis server address
- `6379` - Redis port
- `0` - Database number (0-15)

---

## 5. Install Python Dependencies

### Install Celery and Redis Python Package

```bash
# Activate virtual environment
cd backend
source .venv/bin/activate

# Install Celery and Redis
pip install celery[redis] redis

# Add to requirements.txt
pip freeze | grep -E "celery|redis" >> requirements.txt
```

### Expected Packages

```
celery==5.3.4
redis==5.0.1
```

---

## 6. Celery Configuration

### Project Structure

Your Celery is already configured in:
- `backend/app/celery_app.py` - Celery application
- `backend/app/tasks/photo_tasks.py` - Photo processing tasks
- `backend/.env` - Environment variables

### Verify Celery Configuration

Check that `backend/app/celery_app.py` contains:

```python
from celery import Celery
from app.core.config import settings

celery_app = Celery(
    'autoparts',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=['app.tasks.photo_tasks']
)

celery_app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    broker_transport_options={'visibility_timeout': 3600},
    broker_connection_retry_on_startup=True,
)
```

---

## 7. Running Celery Worker

### Development Mode (Local Testing)

```bash
# Activate virtual environment
cd backend
source .venv/bin/activate

# Start Celery worker with solo pool (for Windows/local testing)
celery -A app.celery_app worker --loglevel=info --pool=solo

# For Linux production-like environment
celery -A app.celery_app worker --loglevel=info
```

### Production Mode (Linux Server)

```bash
# Start Celery worker
celery -A app.celery_app worker --loglevel=info --detach

# Or use screen/tmux for persistent session
screen -S celery_worker
celery -A app.celery_app worker --loglevel=info
# Press Ctrl+A, then D to detach
```

### Verify Worker is Running

```bash
# Check Celery worker logs
tail -f celery.log

# Check active workers (in another terminal)
celery -A app.celery_app inspect ping
```

---

## 8. Systemd Service for Celery (Production)

### Create Celery Service File

```bash
sudo nano /etc/systemd/system/celery.service
```

### Service Configuration

```ini
[Unit]
Description=Celery Worker Service
After=network.target redis-server.service

[Service]
Type=forking
User=fast
Group=fast
WorkingDirectory=/home/fast/autoparts/backend
Environment="PATH=/home/fast/autoparts/backend/.venv/bin"
ExecStart=/home/fast/autoparts/backend/.venv/bin/celery -A app.celery_app worker --loglevel=info --detach
Restart=always
RestartSec=5

# Logging
StandardOutput=append:/home/fast/autoparts/backend/celery-worker.log
StandardError=append:/home/fast/autoparts/backend/celery-worker-error.log

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service on boot
sudo systemctl enable celery

# Start service
sudo systemctl start celery

# Check status
sudo systemctl status celery
```

---

## 9. Testing Celery Tasks

### Test Photo Upload Task

```bash
# Activate virtual environment
cd backend
source .venv/bin/activate

# Start Python shell
python

# Run test task
>>> from app.tasks.photo_tasks import process_and_upload_photo
>>> result = process_and_upload_photo.delay('test_path', 'test.jpg', 'test_org')
>>> print(f'Task ID: {result.id}')
>>> print(f'Task Status: {result.status}')
```

### Monitor Task Progress

```bash
# In Python shell
>>> from celery.result import AsyncResult
>>> from app.celery_app import celery_app
>>> result = AsyncResult('task-id-here', app=celery_app)
>>> result.status
>>> result.result
```

---

## 10. Monitoring and Maintenance

### Redis Monitoring

```bash
# Real-time monitoring
redis-cli -a Vfcnthredis1! monitor

# Memory usage
redis-cli -a Vfcnthredis1! info memory

# Connected clients
redis-cli -a Vfcnthredis1! client list

# Slow log
redis-cli -a Vfcnthredis1! slowlog get 10
```

### Celery Monitoring

```bash
# Show active workers
celery -A app.celery_app inspect active

# Show registered tasks
celery -A app.celery_app inspect registered

# Show worker statistics
celery -A app.celery_app inspect stats

# Show currently executing tasks
celery -A app.celery_app inspect active
```

### Log Files

```bash
# Redis logs
sudo tail -f /var/log/redis/redis-server.log

# Celery worker logs
tail -f /home/fast/autoparts/backend/celery-worker.log
tail -f /home/fast/autoparts/backend/celery-worker-error.log
```

---

## 11. Troubleshooting

### Redis Connection Issues

```bash
# Test connection
redis-cli -a Vfcnthredis1! ping

# Check if Redis is listening
sudo netstat -tlnp | grep 6379

# Check firewall
sudo ufw status
sudo ufw allow 6379/tcp  # Only if remote access needed
```

### Celery Worker Issues

```bash
# Check if worker can connect to Redis
celery -A app.celery_app inspect ping

# View detailed worker logs
celery -A app.celery_app worker --loglevel=debug

# Purge all queued tasks (if stuck)
celery -A app.celery_app purge
```

### Common Errors

**Error: "Connection refused"**
- Check if Redis is running: `sudo systemctl status redis-server`
- Verify password in `.env` matches Redis config

**Error: "Task not found"**
- Ensure task is registered: `celery -A app.celery_app inspect registered`
- Check task import in `celery_app.py`

**Error: "Timeout waiting for task"**
- Increase task time limit in config
- Check worker is running and processing tasks

---

## 12. Security Best Practices

### Redis Security

```conf
# In /etc/redis/redis.conf

# Use strong password
requirepass YourStrongPassword123!

# Bind to localhost only (unless remote access needed)
bind 127.0.0.1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""
```

### Firewall Configuration

```bash
# Allow Redis only from localhost (default)
sudo ufw deny 6379

# If remote access needed, allow specific IPs
sudo ufw allow from 192.168.1.100 to any port 6379
```

---

## 13. Performance Tuning

### Redis Optimization

```conf
# In /etc/redis/redis.conf

# Set max memory based on available RAM
maxmemory 512mb

# Eviction policy
maxmemory-policy allkeys-lru

# TCP backlog
tcp-backlog 511

# Timeout for idle connections
timeout 300
```

### Celery Optimization

```python
# In celery_app.py

# Limit concurrent tasks
worker_prefetch_multiplier = 1

# Task time limits
task_time_limit = 300  # 5 minutes
task_soft_time_limit = 240  # 4 minutes

# Result expiration
result_expires = 3600  # 1 hour
```

---

## Quick Reference

### Service Commands

```bash
# Redis
sudo systemctl start redis-server
sudo systemctl stop redis-server
sudo systemctl restart redis-server
sudo systemctl status redis-server

# Celery
sudo systemctl start celery
sudo systemctl stop celery
sudo systemctl restart celery
sudo systemctl status celery
```

### Connection Strings

```env
# Local development
REDIS_URL=redis://:Vfcnthredis1!@localhost:6379/0
CELERY_BROKER_URL=redis://:Vfcnthredis1!@localhost:6379/0
CELERY_RESULT_BACKEND=redis://:Vfcnthredis1!@localhost:6379/0

# Remote Redis (example)
REDIS_URL=redis://:Vfcnthredis1!@192.168.1.100:6379/0
```

### Useful Commands

```bash
# Redis CLI
redis-cli -a Vfcnthredis1!

# Flush Redis database (CAUTION: deletes all data)
redis-cli -a Vfcnthredis1! FLUSHDB

# Check Redis memory
redis-cli -a Vfcnthredis1! INFO memory

# Celery worker (development)
celery -A app.celery_app worker --loglevel=info --pool=solo

# Celery worker (production)
celery -A app.celery_app worker --loglevel=info --detach
```

---

## Support

For issues or questions:
- Check logs: `sudo journalctl -u redis-server -f`
- Check logs: `tail -f /home/fast/autoparts/backend/celery-worker.log`
- Redis documentation: https://redis.io/documentation
- Celery documentation: https://docs.celeryq.dev/
