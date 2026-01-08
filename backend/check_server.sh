#!/bin/bash
# Script to diagnose server issues

echo "=== Checking server status ==="

# Check if FastAPI is running
echo "Checking if FastAPI is running..."
ps aux | grep uvicorn

# Check nginx configuration
echo -e "\n=== Checking Nginx configuration ==="
if [ -f /etc/nginx/sites-enabled/default ]; then
    echo "Default nginx config:"
    grep -A 10 -B 5 "client_max_body_size" /etc/nginx/sites-enabled/default
fi

# Check if nginx is running
echo -e "\n=== Checking Nginx status ==="
sudo systemctl status nginx --no-pager -l

# Test API endpoint
echo -e "\n=== Testing API endpoint ==="
curl -I http://localhost:8000/

# Test CORS
echo -e "\n=== Testing CORS ==="
curl -H "Origin: http://vm2512296768.vds.ru" -H "Access-Control-Request-Method: POST" -X OPTIONS http://localhost:8000/api/upload/photo -v

echo -e "\n=== Done ==="
