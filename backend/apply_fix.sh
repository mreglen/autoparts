#!/bin/bash
# Скрипт для применения исправлений Rossko на сервере
# Запустить: bash apply_fix.sh

echo "Начинаем применение исправлений Rossko..."
echo "========================================"

cd /var/www/autoparts/backend || exit 1

# Исправление rossko_stock_filter.py
echo "Исправляем rossko_stock_filter.py..."
if grep -q "from datetime import datetime" app/services/rossko_stock_filter.py && grep -q "isinstance(value, datetime)" app/services/rossko_stock_filter.py; then
    echo "✓ rossko_stock_filter.py уже исправлен"
else
    # Добавляем импорт datetime если его нет
    if ! grep -q "from datetime import datetime" app/services/rossko_stock_filter.py; then
        sed -i 's/import json\nimport logging\nfrom typing import Any/import json\nimport logging\nfrom datetime import datetime\nfrom typing import Any/' app/services/rossko_stock_filter.py
    fi
    
    # Исправляем функцию _safe_text
    sed -i 's/return ""$/if isinstance(value, datetime):\n        return value.isoformat()\n    return str(value).strip() if value else ""/' app/services/rossko_stock_filter.py
    echo "✓ rossko_stock_filter.py исправлен"
fi

# Исправление cart_delivery_refresh.py
echo "Исправляем cart_delivery_refresh.py..."
if grep -q "from datetime import datetime, timezone" app/services/cart_delivery_refresh.py && grep -q "datetime.now(timezone.utc)" app/services/cart_delivery_refresh.py; then
    echo "✓ cart_delivery_refresh.py уже исправлен"
else
    sed -i 's/from datetime import datetime/from datetime import datetime, timezone/' app/services/cart_delivery_refresh.py
    sed -i 's/datetime.utcnow()/datetime.now(timezone.utc)/g' app/services/cart_delivery_refresh.py
    echo "✓ cart_delivery_refresh.py исправлен"
fi

# Исправление carts.py
echo "Исправляем carts.py..."
if grep -q "from datetime import datetime, timezone" app/routers/carts.py && grep -q "datetime.now(timezone.utc)" app/routers/carts.py; then
    echo "✓ carts.py уже исправлен"
else
    sed -i 's/from datetime import datetime/from datetime import datetime, timezone/' app/routers/carts.py
    sed -i 's/datetime.utcnow()/datetime.now(timezone.utc)/g' app/routers/carts.py
    echo "✓ carts.py исправлен"
fi

echo "========================================"
echo "✓ Все исправления применены успешно!"
echo "Теперь можно перезапустить приложение."