"""
Скрипт для проверки состояния заказов Авито в базе данных
Запуск: python -m app.scripts.check_avito_orders
"""

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.avito_orders_cache import AvitoOrderCache
import json

def check_avito_orders():
    db: Session = SessionLocal()
    try:
        # Получаем все заказы
        orders = db.query(AvitoOrderCache).order_by(AvitoOrderCache.created_at.desc()).all()
        
        print(f"\n{'='*80}")
        print(f"Всего заказов в БД: {len(orders)}")
        print(f"{'='*80}\n")
        
        # Статистика по статусам
        status_counts = {}
        closed_count = 0
        closed_processed_count = 0
        closed_unprocessed_count = 0
        
        for order in orders:
            status = order.avito_status_code or 'unknown'
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if status == 'closed':
                closed_count += 1
                if order.closed_processed:
                    closed_processed_count += 1
                else:
                    closed_unprocessed_count += 1
        
        print("Статистика по статусам:")
        for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  {status}: {count}")
        
        print(f"\nЗакрытые заказы (closed):")
        print(f"  Всего: {closed_count}")
        print(f"  Обработанные: {closed_processed_count}")
        print(f"  НЕ обработанные: {closed_unprocessed_count}")
        
        print(f"\n{'='*80}")
        print("НЕОБРАБОТАННЫЕ закрытые заказы:")
        print(f"{'='*80}\n")
        
        unprocessed = [o for o in orders if o.avito_status_code == 'closed' and not o.closed_processed]
        
        if not unprocessed:
            print("Нет необработанных закрытых заказов")
        else:
            for order in unprocessed:
                print(f"Order ID: {order.id}")
                print(f"  Avito Order ID: {order.avito_order_id}")
                print(f"  Status: {order.avito_status_code}")
                print(f"  Closed Processed: {order.closed_processed}")
                print(f"  Total Amount: {order.total_amount}")
                print(f"  Is Paid: {order.is_paid}")
                print(f"  Created At: {order.created_at}")
                print(f"  Synced At: {order.synced_at}")
                
                # Показываем items из avito_data
                avito_data = order.avito_data or {}
                items = avito_data.get('items', [])
                if items:
                    print(f"  Items ({len(items)}):")
                    for item in items:
                        print(f"    - avitoId: {item.get('avitoId')}")
                        print(f"      title: {item.get('title')}")
                        print(f"      count: {item.get('count')}")
                        print(f"      prices: {item.get('prices')}")
                print()
        
        print(f"{'='*80}")
        print("Последние 5 заказов:")
        print(f"{'='*80}\n")
        
        for order in orders[:5]:
            print(f"Order ID: {order.id}")
            print(f"  Avito Order ID: {order.avito_order_id}")
            print(f"  Status: {order.avito_status_code}")
            print(f"  Closed Processed: {order.closed_processed}")
            print(f"  Created At: {order.created_at}")
            print()
            
    finally:
        db.close()

if __name__ == "__main__":
    check_avito_orders()
