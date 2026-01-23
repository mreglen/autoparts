import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.core.config import Settings
from app.models.pending_product import PendingProduct

def create_pending_products_table():
    """Создать таблицу pending_products"""
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    
    # Создаем таблицу
    PendingProduct.__table__.create(engine, checkfirst=True)
    print("Таблица pending_products успешно создана")

if __name__ == "__main__":
    create_pending_products_table()