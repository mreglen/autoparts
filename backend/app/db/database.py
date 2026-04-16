from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import Settings

settings = Settings()

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL


engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=50,          # Увеличено до 50 для обработки множества одновременных запросов
    max_overflow=50,       # Увеличено до 50 для пиковых нагрузок
    pool_timeout=60,       # Увеличен таймаут до 60 секунд
    pool_recycle=1800,     # Переподключение через 30 минут (меньше, чтобы избежать stale connections)
    pool_pre_ping=True,    # Проверка соединения перед использованием
    echo_pool=False        # Отключить логирование пула (включить для отладки)
)

SessionLocal = sessionmaker(
    autocommit=False, 
    autoflush=False, 
    bind=engine,
    expire_on_commit=False  # Предотвращаем expired объекты после commit
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base = declarative_base()