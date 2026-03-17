# 🚀 Complete Guide: Setting Up Celery on Ubuntu Server

## Problem
Video uploads in raw format without processing, and Celery tasks are not being created on the Ubuntu production server.

---

## ✅ Step-by-Step Solution

### 1️⃣ Install Redis (Required for Celery)

```bash
# SSH to your server
ssh vm2512296768

# Update packages
sudo apt update

# Install Redis
sudo apt install -y redis-server

# Start Redis service
sudo systemctl start redis
sudo systemctl enable redis

# Check Redis is running
sudo systemctl status redis

# Test Redis connection
redis-cli ping
# Should return: PONG
```

---

### 2️⃣ Install Celery and Dependencies

```bash
cd /home/fast/autoparts/backend

# Activate virtual environment
source venv/bin/activate

# Install Celery and Redis support
pip install celery[redis] redis

# Verify installation
celery --version
```

---

### 3️⃣ Configure Environment Variables

Edit your `.env` file on the server:

```bash
cd /home/fast/autoparts/backend
nano .env
```

Add or update these lines:

```env
# Celery Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
REDIS_URL=redis://localhost:6379/0

# FFmpeg paths for Ubuntu (update if different)
FFPROBE_PATH=/usr/bin/ffprobe
FFMPEG_PATH=/usr/bin/ffmpeg
```

Install FFmpeg if not installed:

```bash
sudo apt install -y ffmpeg
which ffmpeg
# Should output: /usr/bin/ffmpeg
```

---

### 4️⃣ Create Celery Worker Systemd Service

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/celery-worker.service
```

Paste this content:

```ini
[Unit]
Description=Celery Worker Service for AutoParts
After=network.target redis.service

[Service]
Type=forking
User=fast
Group=fast
WorkingDirectory=/home/fast/autoparts/backend
Environment="PATH=/home/fast/autoparts/backend/venv/bin"
ExecStart=/home/fast/autoparts/backend/venv/bin/celery -A app.celery_app worker --loglevel=info --detach
Restart=always
RestartSec=5

# Output logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=celery-worker

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
# Reload systemd to recognize new service
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable celery-worker

# Start Celery worker
sudo systemctl start celery-worker

# Check status
sudo systemctl status celery-worker

# View logs
sudo journalctl -u celery-worker -f
```

---

### 5️⃣ Alternative: Run Celery Manually (For Testing)

If you want to test before setting up the service:

```bash
cd /home/fast/autoparts/backend
source venv/bin/activate

# Run Celery worker in foreground (for testing)
celery -A app.celery_app worker --loglevel=info

# Or run in background with nohup
nohup celery -A app.celery_app worker --loglevel=info > celery.log 2>&1 &

# Check if running
ps aux | grep celery
```

---

### 6️⃣ Verify Celery is Working

#### Check Celery worker status:

```bash
cd /home/fast/autoparts/backend
source venv/bin/activate

# Ping Celery workers
celery -A app.celery_app inspect ping

# Check active workers
celery -A app.celery_app inspect active

# Check registered tasks
celery -A app.celery_app inspect registered
```

#### Test video upload:

1. Upload a video through the frontend
2. Watch Celery logs in real-time:
   ```bash
   sudo journalctl -u celery-worker -f
   ```
   
3. You should see:
   ```
   [INFO/MainProcess] Received task: app.tasks.video_tasks.process_and_upload_video[...]
   === VIDEO PROCESSING TASK STARTED ===
   Task ID: [...]
   ```

---

### 7️⃣ Troubleshooting

#### Problem: Tasks not being processed

**Check if Redis is running:**
```bash
sudo systemctl status redis
redis-cli ping
```

**Check if Celery worker is running:**
```bash
ps aux | grep celery
sudo systemctl status celery-worker
```

**Check Celery logs:**
```bash
sudo journalctl -u celery-worker --since "10 minutes ago"
```

**Test Redis connection from Python:**
```bash
cd /home/fast/autoparts/backend
source venv/bin/activate
python -c "import redis; r = redis.Redis(); print(r.ping())"
# Should print: True
```

---

#### Problem: Permission errors

**Fix file permissions:**
```bash
sudo chown -R fast:fast /home/fast/autoparts/backend
sudo chmod -R 755 /home/fast/autoparts/backend/uploads
```

---

#### Problem: FFmpeg not found

**Install FFmpeg:**
```bash
sudo apt install -y ffmpeg
which ffmpeg
which ffprobe
```

Update `.env` with correct paths:
```env
FFPROBE_PATH=/usr/bin/ffprobe
FFMPEG_PATH=/usr/bin/ffmpeg
```

---

### 8️⃣ Monitoring Celery

#### Install Flower (Celery monitoring tool):

```bash
cd /home/fast/autoparts/backend
source venv/bin/activate
pip install flower

# Run Flower
celery -A app.celery_app flower --port=5555
```

Access at: `http://your-server-ip:5555`

---

### 9️⃣ Quick Commands Reference

```bash
# Start Celery worker
sudo systemctl start celery-worker

# Stop Celery worker
sudo systemctl stop celery-worker

# Restart Celery worker
sudo systemctl restart celery-worker

# View Celery logs
sudo journalctl -u celery-worker -f

# Check worker status
celery -A app.celery_app status

# Inspect active tasks
celery -A app.celery_app inspect active

# Purge all queued tasks (use carefully!)
celery -A app.celery_app purge
```

---

### 🔟 Production Checklist

- ✅ Redis installed and running
- ✅ Celery and dependencies installed
- ✅ `.env` configured with correct settings
- ✅ FFmpeg installed and paths configured
- ✅ Systemd service created and enabled
- ✅ Celery worker running (`sudo systemctl status celery-worker`)
- ✅ Test video upload successful
- ✅ Logs show tasks being processed

---

## 📝 Example: Full Setup Script

Copy and paste this entire script on your Ubuntu server:

```bash
#!/bin/bash

echo "🚀 Setting up Celery on Ubuntu..."

# Install dependencies
sudo apt update
sudo apt install -y redis-server ffmpeg

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Navigate to backend
cd /home/fast/autoparts/backend

# Activate venv and install Celery
source venv/bin/activate
pip install celery[redis] redis

# Create systemd service
sudo tee /etc/systemd/system/celery-worker.service > /dev/null << 'EOF'
[Unit]
Description=Celery Worker Service for AutoParts
After=network.target redis.service

[Service]
Type=forking
User=fast
Group=fast
WorkingDirectory=/home/fast/autoparts/backend
Environment="PATH=/home/fast/autoparts/backend/venv/bin"
ExecStart=/home/fast/autoparts/backend/venv/bin/celery -A app.celery_app worker --loglevel=info --detach
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=celery-worker

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable celery-worker
sudo systemctl start celery-worker

# Verify
echo ""
echo "✅ Setup complete!"
echo ""
echo "Checking Celery status..."
sudo systemctl status celery-worker --no-pager
echo ""
echo "Testing Redis..."
redis-cli ping
echo ""
echo "To view logs: sudo journalctl -u celery-worker -f"
```

Save as `setup_celery.sh`, make executable, and run:
```bash
chmod +x setup_celery.sh
./setup_celery.sh
```

---

## 🎯 After Setup

Once Celery is properly configured and running:

1. **Upload a test video** through the frontend
2. **Watch the logs**:
   ```bash
   sudo journalctl -u celery-worker -f
   ```
3. **Verify video is processed** (compressed, watermarked)
4. **Check database** has `created_at` and `updated_at` columns (run migration first!)

Your videos should now be processed correctly! 🎉
