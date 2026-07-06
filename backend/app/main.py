from fastapi import FastAPI, Response
from fastapi.staticfiles import StaticFiles
from app.db.database import Base, engine
from app.db.schema_patches import (
    ensure_avito_order_fulfillment_columns,
    ensure_event_log_audit_columns,
    ensure_user_public_code,
    ensure_garage_used_order_item_fulfillment_columns,
    ensure_garage_order_delivery_columns,
    ensure_organization_markup_columns,
    ensure_stock_out_source_columns,
    ensure_avito_pro_status_columns,
    ensure_site_reviews_table,
    ensure_site_reviews_user_id_column,
    ensure_site_settings_show_site_reviews_column,
    ensure_site_settings_show_yandex_badge_column,
    ensure_site_settings_used_parts_purchase_mode_column,
    ensure_site_settings_round_product_prices_column,
    ensure_group_chat_columns,
    ensure_chat_created_by_column,
    ensure_seo_product_url_exports_table,
    ensure_seo_new_part_url_exports_table,
    ensure_seo_sitemap_cache_table,
    ensure_new_parts_seo_sync_log_table,
    ensure_seo_sync_pending_candidates_table,
    ensure_seo_rossko_seed_queue_table,
    ensure_seo_sync_daily_counters_table,
    ensure_seo_sync_daily_counters_created_by_source_column,
    ensure_seo_pipeline_state_table,
    ensure_user_avatar_column,
    ensure_user_notification_preference_columns,
    ensure_product_photo_thumb_url_column,
    ensure_rossko_settings_table,
    ensure_rossko_settings_row_defaults,
    ensure_garage_new_order_rossko_columns,
    ensure_garage_new_order_item_seo_card_column,
    ensure_garage_new_order_user_id_column,
    ensure_garage_used_order_user_id_column,
    ensure_garage_used_order_buyer_comment_column,
    ensure_cart_max_quantity_columns,
    ensure_yookassa_payment_tables,
    ensure_yookassa_refund_columns,
    ensure_garage_new_order_yookassa_columns,
    ensure_seo_landing_pages_table,
    ensure_openrouter_tables,
    ensure_site_analytics_attribution_columns,
    ensure_site_analytics_conversion_events_table,
    ensure_analytics_query_review_tables,
    ensure_public_catalog_indexes,
    ensure_product_drafts_table,
    ensure_order_return_tables,
)
from fastapi.middleware.cors import CORSMiddleware
from app.middleware.rate_limit_middleware import RateLimitMiddleware
from app.middleware.slow_request_middleware import SlowRequestLoggingMiddleware
from app.routers import api_router
from app.routers import chats as chats_router
from app.routers import websocket as websocket_router
from app.routers import notifications as notifications_router
from app.routers import avito_messenger_webhook as avito_messenger_webhook_router
from app.tasks.yandex_feed_tasks import run_yandex_feed_sync
from app.utils.celery_enqueue import enqueue_celery_task
from app.utils.scheduler_leader import (
    try_acquire_scheduler_lock,
    renew_scheduler_lock,
    release_scheduler_lock,
)
from app.utils.yandex_integration_db import (
    get_or_create_yandex_feed_sync_state,
    get_or_create_yandex_integration,
)
from app.models import user, organization, product, pending_product, rejected_product, pending_user, pending_seller, password_reset_token, pending_product_storage_cell, carts
from app.models import chat  # noqa: F401 — chat models в metadata
import app.models.site_settings  # noqa: F401 — site_settings в metadata
import app.models.organization_avito_integration  # noqa: F401 — avito integration
import app.models.organization_avito_autoload_cache  # noqa: F401 — avito autoload cache
import app.models.transmission  # noqa: F401 — transmissions, vehicle_transmissions в metadata
import app.models.site_yandex_integration  # noqa: F401 — yandex integration
import app.models.site_google_integration  # noqa: F401 — google search console integration
import app.models.google_oauth_state  # noqa: F401 — google oauth state
import app.models.yandex_feed_sync_state  # noqa: F401 — yandex feed sync state
import app.models.yandex_oauth_state  # noqa: F401 — yandex oauth state
import app.models.site_delivery_option  # noqa: F401 — site delivery matrix
import app.models.site_quick_link  # noqa: F401 — site quick links
import app.models.site_analytics  # noqa: F401 — site analytics
import app.models.analytics_query_review  # noqa: F401 — query review snapshots
import app.models.site_review  # noqa: F401 — site reviews
import app.models.seo_product_url_export  # noqa: F401 — SEO URL export tracking
import app.models.seo_new_part_url_export  # noqa: F401 — Rossko SEO URL export tracking
import app.models.seo_sitemap_cache  # noqa: F401 — SEO sitemap cache
import app.models.rossko_settings  # noqa: F401 — Rossko checkout settings
import app.models.new_parts_checkout_session  # noqa: F401 — YooKassa checkout sessions
import app.models.yookassa_payment  # noqa: F401 — YooKassa payments
import app.models.new_parts_seo_card  # noqa: F401 — SEO cards for supplier new parts
import app.models.new_parts_seo_sync_log  # noqa: F401 — SEO sync log for products→Rossko
import app.models.seo_sync_pending_candidate  # noqa: F401 — persisted cross/sibling queue
import app.models.seo_rossko_seed_queue  # noqa: F401 — Rossko seed pre-check queue
import app.models.seo_sync_daily_counter  # noqa: F401 — daily API budget counters
import app.models.seo_pipeline_state  # noqa: F401 — TecDoc harvest cursors
import app.models.seo_landing_page  # noqa: F401 — SEO landing pages registry
import app.models.site_openrouter_integration  # noqa: F401 — OpenRouter integration
import app.models.organization_ai_description_access  # noqa: F401 — AI description org allowlist
import app.models.product_draft  # noqa: F401 — product drafts
from fastapi.requests import Request
from fastapi.responses import JSONResponse, FileResponse
from app.core.config import settings
import uvicorn
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from app.db.database import get_db
from app.core.auth import cleanup_expired_sessions
from app.utils.guest_cart import cleanup_expired_guest_carts
import logging
import os
import sys
import asyncio
from datetime import datetime, timezone

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
    ensure_garage_order_delivery_columns()
    ensure_avito_order_fulfillment_columns()
    ensure_avito_pro_status_columns()
    ensure_site_reviews_table()
    ensure_site_reviews_user_id_column()
    ensure_site_settings_show_site_reviews_column()
    ensure_site_settings_show_yandex_badge_column()
    ensure_site_settings_used_parts_purchase_mode_column()
    ensure_site_settings_round_product_prices_column()
    ensure_event_log_audit_columns()
    ensure_user_public_code()
    ensure_group_chat_columns()
    ensure_chat_created_by_column()
    ensure_seo_product_url_exports_table()
    ensure_seo_new_part_url_exports_table()
    ensure_seo_sitemap_cache_table()
    ensure_new_parts_seo_sync_log_table()
    ensure_seo_sync_pending_candidates_table()
    ensure_seo_rossko_seed_queue_table()
    ensure_seo_sync_daily_counters_table()
    ensure_seo_sync_daily_counters_created_by_source_column()
    ensure_seo_pipeline_state_table()
    ensure_user_avatar_column()
    ensure_user_notification_preference_columns()
    ensure_product_photo_thumb_url_column()
    ensure_rossko_settings_table()
    ensure_rossko_settings_row_defaults()
    ensure_garage_new_order_rossko_columns()
    ensure_garage_new_order_item_seo_card_column()
    ensure_garage_new_order_user_id_column()
    ensure_garage_used_order_user_id_column()
    ensure_garage_used_order_buyer_comment_column()
    ensure_cart_max_quantity_columns()
    ensure_yookassa_payment_tables()
    ensure_yookassa_refund_columns()
    ensure_garage_new_order_yookassa_columns()
    ensure_seo_landing_pages_table()
    ensure_openrouter_tables()
    ensure_site_analytics_attribution_columns()
    ensure_site_analytics_conversion_events_table()
    ensure_analytics_query_review_tables()
    ensure_public_catalog_indexes()
    ensure_product_drafts_table()
    ensure_order_return_tables()
except Exception as e:
    logger.error(f"Error applying schema patches: {e}")
    raise

try:
    from app.db.database import SessionLocal
    from app.services.seo_landing_page_service import seed_landing_pages_from_catalog

    _seed_db = SessionLocal()
    try:
        seed_landing_pages_from_catalog(_seed_db, force=False)
    finally:
        _seed_db.close()
except Exception as e:
    logger.warning("SEO landing pages seed skipped: %s", e)

app = FastAPI(title="Автозапчасти")

scheduler = None
_scheduler_leader = False
_scheduler_renew_task = None

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
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SlowRequestLoggingMiddleware)


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
    """Initialize WebSocket bridge on every worker; scheduler only on Redis leader."""
    global scheduler, _scheduler_leader, _scheduler_renew_task

    await websocket_router.manager.start_pubsub_bridge()

    _scheduler_leader = try_acquire_scheduler_lock()
    if not _scheduler_leader:
        logger.info("Scheduler skipped (not leader)")
        return

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
    scheduler.add_job(
        func=run_yandex_feed_scheduler_tick,
        trigger=IntervalTrigger(minutes=5),
        id='yandex_feed_sync_tick',
        name='Yandex feed event-driven sync tick',
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_rebuild_products_sitemap_cache,
        trigger=CronTrigger(hour=settings.SITEMAP_REBUILD_HOUR_UTC, minute=0),
        id="rebuild_products_sitemap_cache",
        name="Rebuild cached products sitemap daily",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_new_parts_seo_sync_tick,
        trigger=IntervalTrigger(minutes=settings.NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES),
        id="new_parts_seo_sync_batch",
        name="Rossko SEO cards micro-batch sync",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_refresh_new_parts_seo_cards,
        trigger=IntervalTrigger(hours=settings.NEW_PARTS_SEO_REFRESH_INTERVAL_HOURS),
        id="refresh_new_parts_seo_cards",
        name="Refresh Rossko SEO card prices and stock",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_seo_seed_precheck_tick,
        trigger=IntervalTrigger(minutes=settings.NEW_PARTS_SEO_SEED_PRECHECK_INTERVAL_MINUTES),
        id="seo_rossko_seed_precheck",
        name="Rossko SEO seed queue pre-check",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_seo_tecdoc_harvest,
        trigger=CronTrigger(hour=2, minute=0),
        id="seo_tecdoc_harvest",
        name="Harvest TecDoc brand/article pairs for Rossko seed queue",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_seo_seed_populate,
        trigger=CronTrigger(hour=2, minute=30),
        id="seo_rossko_seed_populate",
        name="Populate Rossko SEO seed queue nightly",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_seo_seed_populate,
        trigger=CronTrigger(hour=14, minute=0),
        id="seo_rossko_seed_populate_afternoon",
        name="Populate Rossko SEO seed queue afternoon",
        replace_existing=True,
    )
    scheduler.add_job(
        func=run_weekly_backups,
        trigger=CronTrigger(day_of_week="sun", hour=settings.BACKUP_WEEKLY_HOUR_UTC, minute=0),
        id="weekly_backups",
        name="Weekly database and uploads backups",
        replace_existing=True,
    )
    
    scheduler.start()
    logger.info("Scheduler started. Expired session cleanup job scheduled.")
    _scheduler_renew_task = asyncio.create_task(_scheduler_leader_renew_loop())

    try:
        from app.tasks.seo_tasks import rebuild_sitemaps_cache_task

        rebuild_sitemaps_cache_task.apply_async(countdown=60)
        logger.info("Products sitemap cache warm-up dispatched to Celery (countdown=60s).")
    except Exception as exc:
        logger.warning("Failed to dispatch sitemap warm-up to Celery: %s", exc)

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

    try:
        from app.services.organization_chat_service import backfill_all_organization_chats
        from app.db.database import get_db

        db = next(get_db())
        try:
            backfill_all_organization_chats(db)
            logger.info("Organization group chats backfill completed")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Ошибка при backfill групповых чатов организаций: {str(e)}")


@app.on_event("shutdown")
async def shutdown_event():
    global scheduler, _scheduler_leader, _scheduler_renew_task

    await websocket_router.manager.stop_pubsub_bridge()

    if _scheduler_renew_task:
        _scheduler_renew_task.cancel()
        try:
            await _scheduler_renew_task
        except asyncio.CancelledError:
            pass
        _scheduler_renew_task = None

    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler уничтожен")
        scheduler = None

    if _scheduler_leader:
        release_scheduler_lock()
        _scheduler_leader = False


async def _scheduler_leader_renew_loop():
    while True:
        await asyncio.sleep(30)
        if not renew_scheduler_lock():
            logger.warning("Lost scheduler leader lock; stopping renew loop")
            break


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


async def run_rebuild_products_sitemap_cache():
    try:
        from app.tasks.seo_tasks import rebuild_sitemaps_cache_task

        await enqueue_celery_task(rebuild_sitemaps_cache_task)
        logger.info("Sitemap rebuild dispatched to Celery")
    except Exception as e:
        logger.error("Ошибка постановки sitemap rebuild в Celery: %s", e)


async def run_new_parts_seo_sync_tick():
    try:
        from app.tasks.seo_tasks import run_new_parts_seo_sync_batch_task

        await enqueue_celery_task(run_new_parts_seo_sync_batch_task)
        logger.info("Rossko SEO micro-batch dispatched to Celery")
    except Exception as e:
        logger.error("Ошибка постановки Rossko SEO micro-batch в Celery: %s", e)


async def run_refresh_new_parts_seo_cards():
    try:
        from app.tasks.seo_tasks import refresh_new_parts_seo_cards_task

        await enqueue_celery_task(refresh_new_parts_seo_cards_task)
        logger.info("Rossko SEO refresh dispatched to Celery")
    except Exception as e:
        logger.error("Ошибка постановки SEO refresh в Celery: %s", e)


async def run_seo_seed_precheck_tick():
    try:
        from app.tasks.seo_tasks import seed_precheck_batch_task

        await enqueue_celery_task(seed_precheck_batch_task)
        logger.info("Rossko SEO seed precheck dispatched to Celery")
    except Exception as e:
        logger.error("Ошибка постановки SEO seed precheck в Celery: %s", e)


async def run_seo_tecdoc_harvest():
    try:
        from app.tasks.seo_tasks import tecdoc_harvest_task

        await enqueue_celery_task(tecdoc_harvest_task)
        logger.info("TecDoc harvest dispatched to Celery")
    except Exception as e:
        logger.error("Ошибка постановки TecDoc harvest в Celery: %s", e)


async def run_seo_seed_populate():
    try:
        from app.tasks.seo_tasks import seed_populate_task

        await enqueue_celery_task(seed_populate_task)
        logger.info("Rossko SEO seed populate dispatched to Celery")
    except Exception as e:
        logger.error("Ошибка постановки SEO seed populate в Celery: %s", e)


async def run_weekly_backups():
    try:
        from app.services.backup_service import run_scheduled_backups

        result = run_scheduled_backups()
        logger.info("Weekly backups completed: %s", result)
    except Exception as e:
        logger.error("Ошибка еженедельного резервного копирования: %s", e)


async def run_yandex_feed_scheduler_tick():
    """
    Проверяет pending_sync и запускает синхронизацию в Celery с учетом дебаунса.
    Плюс выполняет контрольный прогон по интервалу.
    """
    try:
        db_gen = get_db()
        db = next(db_gen)
        try:
            integration = get_or_create_yandex_integration(db)
            state = get_or_create_yandex_feed_sync_state(db)
            if not integration.enabled:
                return

            now = datetime.now(timezone.utc)
            should_enqueue = False

            if state.sync_in_progress:
                return

            if state.pending_sync and integration.event_driven_enabled:
                debounce = int(integration.debounce_seconds or 300)
                event_at = state.last_event_at
                if event_at and event_at.tzinfo is None:
                    event_at = event_at.replace(tzinfo=timezone.utc)
                if event_at is None:
                    should_enqueue = True
                else:
                    should_enqueue = (now - event_at).total_seconds() >= debounce

            control_interval = int(integration.control_sync_interval_minutes or 720)
            last_finished = state.last_sync_finished_at
            if last_finished and last_finished.tzinfo is None:
                last_finished = last_finished.replace(tzinfo=timezone.utc)
            if not should_enqueue:
                if last_finished is None:
                    should_enqueue = True
                else:
                    should_enqueue = (now - last_finished).total_seconds() >= control_interval * 60

            if should_enqueue:
                state.last_enqueued_at = now
                db.add(state)
                db.commit()
                await enqueue_celery_task(run_yandex_feed_sync, trigger="scheduler", force=False)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Ошибка в scheduler tick Yandex feed: {str(e)}")


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