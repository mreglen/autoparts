import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from app.core.config import Settings
from app.models.rejected_product import RejectedProduct

def create_rejected_products_table():
    """Создать таблицу rejected_products"""
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    
    # Создаем таблицу
    RejectedProduct.__table__.create(engine, checkfirst=True)
    print("Таблица rejected_products успешно создана")

if __name__ == "__main__":
    create_rejected_products_table()