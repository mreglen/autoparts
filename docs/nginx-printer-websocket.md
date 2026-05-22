# Nginx Fix For Printer Agent WebSocket

The printer agent connects to:

```text
wss://svoygarage.ru/server/api/printers/ws
```

This path must be proxied as a WebSocket before the generic `/server/api/` and `/api/` API locations. Add these blocks to `/etc/nginx/sites-available/svoygarage` inside each relevant `server { ... }` block, above the existing `location /server/api/` and `location /api/` blocks.

```nginx
location /server/api/printers/ws {
    proxy_pass http://127.0.0.1:8080/api/printers/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_buffering off;
}

location /api/printers/ws {
    proxy_pass http://127.0.0.1:8080/api/printers/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
    proxy_buffering off;
}
```

Then validate and reload nginx:

```bash
nginx -t
systemctl reload nginx
```

After reload, run the updated agent and check that printers appear in the application settings.
