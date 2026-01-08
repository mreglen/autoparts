#!/bin/bash
# Script to fix server configuration issues

echo "=== Fixing server configuration ==="

# Stop services
echo "Stopping services..."
sudo systemctl stop nginx
sudo pkill -f uvicorn

# Update nginx configuration
echo -e "\n=== Updating Nginx configuration ==="
sudo tee /etc/nginx/sites-available/fastapi <<EOF
server {
    listen 80;
    server_name vm2512296768.vds.ru 195.24.65.251;

    # Allow large file uploads
    client_max_body_size 50M;

    # Timeout settings
    client_body_timeout 300s;
    client_header_timeout 60s;
    send_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' 'http://vm2512296768.vds.ru' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' '*' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;

        # Handle OPTIONS
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'http://vm2512296768.vds.ru' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' '*' always;
            add_header 'Access-Control-Allow-Credentials' 'true' always;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Static files
    location /uploads/ {
        alias /path/to/your/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";

        # CORS for static files
        add_header 'Access-Control-Allow-Origin' 'http://vm2512296768.vds.ru' always;
        add_header 'Access-Control-Allow-Headers' '*' always;
    }
}
EOF

# Enable site and disable default
sudo ln -sf /etc/nginx/sites-available/fastapi /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
echo -e "\n=== Testing Nginx configuration ==="
sudo nginx -t

# Start nginx
echo -e "\n=== Starting Nginx ==="
sudo systemctl start nginx

# Start FastAPI
echo -e "\n=== Starting FastAPI ==="
cd /path/to/your/backend
source venv/bin/activate  # или .venv/bin/activate в зависимости от названия
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 &

echo -e "\n=== Services started ==="

# Wait a bit and test
sleep 3
echo -e "\n=== Testing configuration ==="
curl -H "Origin: http://vm2512296768.vds.ru" -X OPTIONS http://localhost:8000/api/upload/photo -v | head -20

echo -e "\n=== Done. Check if everything works ==="
