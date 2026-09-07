#!/usr/bin/env python3
"""
Скрипт для применения исправлений Rossko на сервере
Запустить на сервере: python3 rossko_fix_server.py
"""

import os
import sys

def fix_rossko_stock_filter():
    """Исправление app/services/rossko_stock_filter.py"""
    file_path = "/var/www/autoparts/backend/app/services/rossko_stock_filter.py"
    
    if not os.path.exists(file_path):
        print(f"Файл не найден: {file_path}")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Проверяем, уже ли применено исправление
    if 'from datetime import datetime' in content and 'isinstance(value, datetime)' in content:
        print("Исправление rossko_stock_filter.py уже применено")
        return True
    
    # Добавляем импорт datetime
    if 'from datetime import datetime' not in content:
        content = content.replace(
            'import json\nimport logging\nfrom typing import Any',
            'import json\nimport logging\nfrom datetime import datetime\nfrom typing import Any'
        )
    
    # Исправляем функцию _safe_text
    old_safe_text = '''def _safe_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    return ""'''
    
    new_safe_text = '''def _safe_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value).strip() if value else ""'''
    
    content = content.replace(old_safe_text, new_safe_text)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Исправлен rossko_stock_filter.py")
    return True

def fix_cart_delivery_refresh():
    """Исправление app/services/cart_delivery_refresh.py"""
    file_path = "/var/www/autoparts/backend/app/services/cart_delivery_refresh.py"
    
    if not os.path.exists(file_path):
        print(f"Файл не найден: {file_path}")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Проверяем, уже ли применено исправление
    if 'from datetime import datetime, timezone' in content and 'datetime.now(timezone.utc)' in content:
        print("Исправление cart_delivery_refresh.py уже применено")
        return True
    
    # Заменяем импорт
    content = content.replace(
        'from datetime import datetime',
        'from datetime import datetime, timezone'
    )
    
    # Заменяем datetime.utcnow() на datetime.now(timezone.utc)
    content = content.replace('datetime.utcnow()', 'datetime.now(timezone.utc)')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Исправлен cart_delivery_refresh.py")
    return True

def fix_carts_router():
    """Исправление app/routers/carts.py"""
    file_path = "/var/www/autoparts/backend/app/routers/carts.py"
    
    if not os.path.exists(file_path):
        print(f"Файл не найден: {file_path}")
        return False
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Проверяем, уже ли применено исправление
    if 'from datetime import datetime, timezone' in content and 'datetime.now(timezone.utc)' in content:
        print("Исправление carts.py уже применено")
        return True
    
    # Заменяем импорт
    content = content.replace(
        'from datetime import datetime',
        'from datetime import datetime, timezone'
    )
    
    # Заменяем datetime.utcnow() на datetime.now(timezone.utc)
    content = content.replace('datetime.utcnow()', 'datetime.now(timezone.utc)')
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✓ Исправлен carts.py")
    return True

def main():
    print("Начинаем применение исправлений Rossko...")
    print("=" * 50)
    
    results = []
    results.append(("rossko_stock_filter.py", fix_rossko_stock_filter()))
    results.append(("cart_delivery_refresh.py", fix_cart_delivery_refresh()))
    results.append(("carts.py", fix_carts_router()))
    
    print("=" * 50)
    print("Результаты:")
    for name, success in results:
        status = "✓ Успешно" if success else "✗ Ошибка"
        print(f"  {name}: {status}")
    
    all_success = all(success for _, success in results)
    if all_success:
        print("\n✓ Все исправления применены успешно!")
        print("Теперь можно перезапустить приложение.")
    else:
        print("\n✗ Некоторые исправления не применены. Проверьте ошибки выше.")
        sys.exit(1)

if __name__ == "__main__":
    main()