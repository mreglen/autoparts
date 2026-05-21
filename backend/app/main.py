from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from app.db.database import Base, engine
from app.db.schema_patches import (
    ensure_avito_order_fulfillment_columns,
    ensure_garage_used_order_item_fulfillment_columns,
    ensure_organization_markup_columns,
    ensure_stock_out_source_columns,
)
from fastapi.middleware.cors import CORSMiddleware
from app.routers import api_router
from app.routers import chats as chats_router
from app.routers import websocket as websocket_router
from app.routers import notifications as notifications_router
from app.routers import avito_messenger_webhook as avito_messenger_webhook_router
from app.models import user, organization, product, pending_product, rejected_product, pending_user, pending_seller, password_reset_token, pending_product_storage_cell, carts
from app.models import chat  # noqa: F401 — chat models в metadata
import app.models.site_settings  # noqa: F401 — site_settings в metadata
import app.models.organization_avito_integration  # noqa: F401 — avito integration
import app.models.organization_avito_autoload_cache  # noqa: F401 — avito autoload cache
import app.models.transmission  # noqa: F401 — transmissions, vehicle_transmissions в metadata
from fastapi.requests import Request
from fastapi.responses import JSONResponse, FileResponse
from app.core.config import settings
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from app.db.database import get_db
from app.core.auth import cleanup_expired_sessions
from app.utils.guest_cart import cleanup_expired_guest_carts
import logging
import os
import sys
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Fix for Windows: ensure subprocess support in asyncio event loop (needed for Playwright).
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

# Создаём в БД только те таблицы из metadata, которых ещё нет.
# Раньше сравнивали len(existing) < len(metadata) — если в БД таблиц больше, чем в ORM,
# create_all никогда не вызывался и новые модели не появлялись.
from sqlalchemy import inspect

try:
    inspector = inspect(engine)
    _existing = set(inspector.get_table_names())
    _needed = set(Base.metadata.tables.keys())
    if _needed - _existing:
        logger.info(f"Creating missing tables: {_needed - _existing}")
        Base.metadata.create_all(bind=engine)
        logger.info("All tables created successfully")
except Exception as e:
    logger.error(f"Error creating tables: {e}")
    raise

try:
    ensure_organization_markup_columns()
    ensure_stock_out_source_columns()
    ensure_garage_used_order_item_fulfillment_columns()
    ensure_avito_order_fulfillment_columns()
except Exception as e:
    logger.error(f"Error applying schema patches: {e}")
    raise

app = FastAPI(title="Автозапчасти")

# Best-effort proxy header support. In production, also run uvicorn with proxy headers enabled.
try:
    from starlette.middleware.proxy_headers import ProxyHeadersMiddleware  # type: ignore

    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")
except Exception:
    pass


def _cors_origins() -> list[str]:
    if settings.CORS_ALLOW_ORIGINS:
        return [o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",") if o.strip()]
    # dev defaults
    return [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Guest-Cart-Token"],
)


@app.middleware("http")
async def handle_large_files(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        if "413" in str(e) or "Request Entity Too Large" in str(e):
            return JSONResponse(
                status_code=413,
                content={"detail": "Файл слишком большой. Максимальный размер: 50MB"}
            )
        raise e


@app.on_event("startup")
async def startup_event():
    """Initialize the scheduler when the application starts."""
    global scheduler
    scheduler = AsyncIOScheduler()
    
    scheduler.add_job(
        func=run_cleanup_expired_sessions,
        trigger=IntervalTrigger(hours=1),
        id='cleanup_expired_sessions',
        name='Clean up expired user sessions every hour',
        replace_existing=True
    )
    scheduler.add_job(
        func=run_cleanup_expired_guest_carts,
        trigger=IntervalTrigger(hours=1),
        id='cleanup_expired_guest_carts',
        name='Clean up expired guest carts every hour',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started. Expired session cleanup job scheduled.")
    
    
    try:
        from app.models.delivery_method import DeliveryMethod, organization_delivery_methods
        from app.models.organization import Organization
        from app.db.database import get_db
        
 
        db = next(get_db())
        try:
            default_delivery_method = db.query(DeliveryMethod).filter(DeliveryMethod.id == 1).first()
            if default_delivery_method:
                organizations = db.query(Organization).all()
                
                populated_count = 0
                for org in organizations:
                   
                    from sqlalchemy import text
                    result = db.execute(text(
                        "SELECT * FROM organization_delivery_methods WHERE organization_id = :org_id AND delivery_method_id = :method_id"
                    ), {"org_id": org.id, "method_id": 1})
                    existing = result.fetchone()
                    
                    if not existing:
                        db.execute(
                            organization_delivery_methods.insert().values(
                                organization_id=org.id,
                                delivery_method_id=1
                            )
                        )
                        populated_count += 1
                
                if populated_count > 0:
                    db.commit()
                    logger.info(f" {populated_count}")
                else:
                    logger.info("Все организации с методами доставки настроены")
            else:
                logger.warning("Метод доставки по умолчанию (ID=1) не найден")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Ошибка при заполнении методами доставки: {str(e)}")


@app.on_event("shutdown")
async def shutdown_event():
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler уничтожен")


async def run_cleanup_expired_sessions():
    try:
        db_gen = get_db()
        db = next(db_gen)
        
        try:
            deleted_count = cleanup_expired_sessions(db, hours_threshold=24)
            logger.info(f"Удалено {deleted_count} сессий пользователей с истекшим сроком действия")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Ошибка при очистке сессий пользователей: {str(e)}")


async def run_cleanup_expired_guest_carts():
    try:
        db_gen = get_db()
        db = next(db_gen)
        try:
            deleted_count = cleanup_expired_guest_carts(db)
            logger.info(f"Удалено {deleted_count} гостевых корзин с истекшим сроком действия")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Ошибка при очистке гостевых корзин: {str(e)}")


app.include_router(api_router)
app.include_router(chats_router.router)
app.include_router(websocket_router.router)
app.include_router(notifications_router.router)
app.include_router(avito_messenger_webhook_router.router)

from app.routers import part_types as part_types_router
app.include_router(part_types_router.router, prefix="/api")

import os
from pathlib import Path

uploads_dir = Path(__file__).parent.parent / "uploads"
if uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
else:
    logger.error(f"Каталог загрузок не найден: {uploads_dir}")

pictures_dir = Path(__file__).parent.parent / "uploads" / "pictures"
if pictures_dir.exists():
    app.mount("/pictures", StaticFiles(directory=str(pictures_dir)), name="pictures")
else:
    logger.error(f"Каталог изображений не найден: {pictures_dir}")

videos_dir = Path(__file__).parent.parent / "uploads" / "videos"
if videos_dir.exists():
    app.mount("/videos", StaticFiles(directory=str(videos_dir)), name="videos")
else:
    logger.error(f"Каталог видео не найден: {videos_dir}")

vehicle_pictures_dir = Path(__file__).parent.parent / "uploads" / "vehicle_pictures"
if vehicle_pictures_dir.exists():
    app.mount("/vehicle_pictures", StaticFiles(directory=str(vehicle_pictures_dir)), name="vehicle_pictures")
else:
    logger.error(f"Каталог vehicle_pictures не найден: {vehicle_pictures_dir}")



@app.get("/media/{path:path}")
async def get_media_file(path: str):

    if path.startswith("pictures/"):
        base_dir = Path(__file__).parent.parent / "uploads" / "pictures"
        relative_path = path.replace("pictures/", "")
    elif path.startswith("videos/"):
        base_dir = Path(__file__).parent.parent / "uploads" / "videos"
        relative_path = path.replace("videos/", "")
    elif path.startswith("vehicle_pictures/"):
        base_dir = Path(__file__).parent.parent / "uploads" / "vehicle_pictures"
        relative_path = path.replace("vehicle_pictures/", "")
    elif path.startswith("temp/"):
        # Serve temp videos for immediate playback
        base_dir = Path(__file__).parent.parent / "uploads" / "temp"
        relative_path = path.replace("temp/", "")
    else:
        return JSONResponse(status_code=404, content={"detail": "File not found"})
    
    file_path = base_dir / relative_path
    
   
    if not file_path.exists():
        return JSONResponse(status_code=404, content={"detail": "File not found"})
    
    media_type = "image/webp"
    if path.endswith(".mp4") or path.endswith(".avi") or path.endswith(".mov") or path.endswith(".webm"):
        media_type = "video/mp4"
    elif path.endswith(".jpg") or path.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif path.endswith(".png"):
        media_type = "image/png"
    
    
    response = FileResponse(str(file_path), media_type=media_type)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


@app.get("/")
def read_root():
    return {"API"}