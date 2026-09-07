# Deployment Instructions for Rossko Warehouse Discovery Fix

## Changes Made

### Local Testing Results
- ✅ Fixed `_safe_text()` function to handle datetime objects in `rossko_stock_filter.py`
- ✅ Updated deprecated `datetime.utcnow()` to `datetime.now(timezone.utc)` 
- ✅ Warehouse discovery now correctly identifies 232 stocks with delivery windows
- ✅ Warehouse selection and filtering functionality verified working
- ✅ Delivery date update functionality verified working correctly

### Files Modified
1. `app/services/rossko_stock_filter.py` - Added datetime handling to `_safe_text()`
2. `app/services/cart_delivery_refresh.py` - Fixed datetime deprecation
3. `app/routers/carts.py` - Fixed datetime deprecation in multiple locations

## Manual Deployment Steps

### Option 1: Using SSH (if automated doesn't work)
```bash
# Connect to the server
ssh root@195.24.65.251
# Password: Vfcnthparol123!

# Navigate to backend directory
cd /var/www/autoparts/backend

# Pull latest changes
git pull origin celery_update

# Restart the application (adjust based on your setup)
# Common options:
systemctl restart autoparts-backend  # if using systemd
# or
supervisorctl restart autoparts      # if using supervisor
# or
pkill -f uvicorn && nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

### Option 2: Manual File Transfer
If git pull doesn't work, manually copy the changed files:

```bash
# On local machine, create a patch
cd C:\Users\khram\OneDrive\Рабочий стол\autoparts\backend
git diff HEAD~1 > rossko_fix.patch

# Transfer patch to server
scp rossko_fix.patch root@195.24.65.251:/tmp/

# On server:
ssh root@195.24.65.251
cd /var/www/autoparts/backend
git apply /tmp/rossko_fix.patch
```

## Verification Steps on Server

### 1. Test Warehouse Discovery
```python
# On the server, run:
cd /var/www/autoparts/backend
python3 -c "
from app.db.database import get_db
from app.services.rossko_stock_filter import load_known_stocks
db = next(get_db())
known = load_known_stocks(db)
print(f'Known stocks: {len(known)}')
if known:
    print('First 3 stocks:')
    for stock in known[:3]:
        print(f'  - {stock}')
"
```

### 2. Test Warehouse Selection
```python
python3 -c "
from app.db.database import get_db
from app.utils.rossko_settings_db import get_rossko_settings
from app.services.rossko_stock_filter import parse_allowed_stock_ids
db = next(get_db())
row = get_rossko_settings(db)
allowed = parse_allowed_stock_ids(getattr(row, 'allowed_stock_ids', None))
print(f'Allowed stock IDs configured: {allowed is not None}')
if allowed:
    print(f'Number of allowed stocks: {len(allowed)}')
"
```

### 3. Test Delivery Date Functionality
```python
python3 -c "
from datetime import datetime, timezone
from app.services.cart_delivery_refresh import _apply_delivery

class MockCartItem:
    def __init__(self):
        self.delivery_start = datetime(2026, 1, 1)
        self.delivery_end = datetime(2026, 1, 2)
        self.delivery = 'Old delivery text'
        self.updated_at = datetime.now(timezone.utc)

cart_item = MockCartItem()
offer = {
    'delivery_start': datetime(2026, 9, 13, 19, 15),
    'delivery_end': datetime(2026, 9, 13, 20, 0),
}

changed = _apply_delivery(cart_item, offer)
print(f'Delivery update changed: {changed}')
print(f'New delivery_start: {cart_item.delivery_start}')
print(f'New delivery_end: {cart_item.delivery_end}')
"
```

## Expected Results

After deployment, you should see:
- Warehouse discovery endpoint returns stocks with delivery windows
- Admin interface shows all 232 discovered warehouses
- Warehouse selection functionality works correctly
- Delivery date updates in cart function properly
- No deprecation warnings for datetime usage

## Troubleshooting

If SSH connection fails:
1. Check if SSH is enabled on the server
2. Verify the server IP and credentials
3. Check firewall rules
4. Try using a different SSH client

If git pull fails:
1. Check if the repository is on the correct branch
2. Verify git remote configuration
3. Use manual file transfer option

If application doesn't restart:
1. Check application logs for errors
2. Verify Python dependencies are installed
3. Check if port 8000 is available