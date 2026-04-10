# Инструкция по деплою исправлений WebSocket

## Проблема:
На сервере работает старая версия frontend которая подключается к `wss://svoygarage.ru/ws/chat/2` вместо `wss://svoygarage.ru/server/ws/chat/2`

## Решение:

### Шаг 1: Проверьте .env файл на сервере

```bash
ssh ваш_сервер
cat /var/www/my-autoparts/.env
```

**Должно быть:**
```env
REACT_APP_API_BASE_URL=https://svoygarage.ru/server/api
REACT_APP_BACKEND_BASE_URL=https://svoygarage.ru/server
```

**Если НЕПРАВИЛЬНО** (без `/server`):
```bash
# Исправьте .env
nano /var/www/my-autoparts/.env

# Установите правильные значения:
REACT_APP_API_BASE_URL=https://svoygarage.ru/server/api
REACT_APP_BACKEND_BASE_URL=https://svoygarage.ru/server
```

### Шаг 2: Загрузите новый код на сервер

**Вариант A: Через Git**
```bash
cd /var/www/my-autoparts
git pull origin main  # или ваша ветка
```

**Вариант B: Вручную скопировать файлы**
```bash
# С вашего компьютера
scp -r frontend/my-autoparts/src/* user@server:/var/www/my-autoparts/src/
scp frontend/my-autoparts/.env user@server:/var/www/my-autoparts/.env
```

### Шаг 3: Пересоберите frontend

```bash
cd /var/www/my-autoparts

# Очистите старый build (опционально но рекомендуется)
rm -rf build/

# Установите зависимости если нужно
npm install

# Пересоберите
npm run build

# Проверьте что build успешен
ls -lh build/
```

### Шаг 4: Скопируйте build в nginx directory

```bash
# Обычно nginx смотрит сюда:
sudo cp -r build/* /var/www/my-autoparts/

# Или если nginx настроен напрямую на build:
# (проверьте в nginx config где root)
grep -n "root" /etc/nginx/sites-enabled/svoygarage.ru
```

### Шаг 5: Перезапустите nginx

```bash
sudo nginx -t  # Проверьте конфигурацию
sudo systemctl restart nginx
```

### Шаг 6: Перезапустите backend

```bash
# Зависит от того как у вас запущен backend
# Вариант A: systemd
sudo systemctl restart autoparts-backend

# Вариант B: supervisor
sudo supervisorctl restart autoparts-backend

# Вариант C: вручную
# Найдите процесс
ps aux | grep uvicorn
# Убейте и запустите заново
```

### Шаг 7: Очистите кэш на клиенте

**В браузере пользователя:**

1. **Жесткое обновление:**
   ```
   Ctrl + Shift + R (Windows/Linux)
   Cmd + Shift + R (Mac)
   ```

2. **Или очистите кэш полностью:**
   ```
   F12 → Application → Clear storage → Clear site data
   ```

3. **Обновите Service Worker:**
   ```
   F12 → Application → Service Workers → Update
   ```

### Шаг 8: Проверьте логи

**В браузере (F12 → Console):**

Должно быть:
```
[WS Config] BACKEND_BASE from env: https://svoygarage.ru/server
[WS Config] Processed backendUrl: https://svoygarage.ru/server
[WS Config] Final WebSocket URL: wss://svoygarage.ru/server
[WS] Connecting to: wss://svoygarage.ru/server/ws/chat/2
[WS] WebSocket connected
```

**На сервере (backend логи):**
```bash
# Логи backend
sudo journalctl -u autoparts-backend -f

# Или где у вас логи
tail -f /path/to/backend/logs

# Должно быть:
[WS] Connection attempt for user_id=2
[WS] Successfully connected user_id=2
```

**Nginx логи:**
```bash
sudo tail -f /var/log/nginx/svoygarage_ssl_access.log
sudo tail -f /var/log/nginx/svoygarage_ssl_error.log
```

## Проверка что всё работает:

1. Откройте https://svoygarage.ru
2. Откройте консоль (F12)
3. Войдите в систему
4. Проверьте логи - должен быть правильный URL
5. Отправьте сообщение из другого браузера
6. Проверьте что push-уведомление приходит с именем отправителя
7. Кликните на уведомление - должен открыться правильный чат

## Если всё еще не работает:

### Проверьте что .env правильно загружен:

```javascript
// Временно добавьте в ChatSlice.js перед connectWebSocket:
console.log('REACT_APP_BACKEND_BASE_URL:', process.env.REACT_APP_BACKEND_BASE_URL);
```

### Проверьте nginx config:

```bash
nginx -T | grep -A 10 "location /server/ws/"
```

Должно быть:
```nginx
location /server/ws/ {
    proxy_pass http://127.0.0.1:8080/ws/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    ...
}
```

### Проверьте что backend слушает правильный порт:

```bash
sudo netstat -tlnp | grep 8080
# или
sudo ss -tlnp | grep 8080
```

## Автоматический скрипт деплоя:

Создайте файл `deploy.sh`:

```bash
#!/bin/bash
echo "🚀 Starting deployment..."

# Pull latest code
cd /var/www/my-autoparts
git pull origin main

# Install dependencies
npm install

# Build frontend
npm run build

# Copy to nginx directory
sudo cp -r build/* /var/www/my-autoparts/

# Restart services
sudo systemctl restart nginx
sudo systemctl restart autoparts-backend

echo "✅ Deployment complete!"
echo "🔄 Please clear browser cache: Ctrl+Shift+R"
```

Сделайте его исполняемым:
```bash
chmod +x deploy.sh
```

Запустите:
```bash
./deploy.sh
```
