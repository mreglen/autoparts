from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from app.core.config import Settings

settings = Settings()

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL


def _uses_pgbouncer(database_url: str) -> bool:
    return ":6432" in database_url


def _build_engine():
    common = {
        "pool_pre_ping": True,
        "echo_pool": False,
    }
    if _uses_pgbouncer(SQLALCHEMY_DATABASE_URL):
        from sqlalchemy.pool import NullPool

        # psycopg2: NullPool only (prepare_threshold is psycopg3-only).
        return create_engine(
            SQLALCHEMY_DATABASE_URL,
            poolclass=NullPool,
            **common,
        )

    return create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=60,
        pool_recycle=1800,
        **common,
    )


engine = _build_engine()

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
