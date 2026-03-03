from celery import Celery
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    'autoparts',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=['app.tasks.photo_tasks']
)

# Configure Celery with more explicit settings
celery_app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max runtime
    worker_prefetch_multiplier=1,
    broker_transport_options={'visibility_timeout': 3600},  # 1 hour
    broker_connection_retry_on_startup=True,
)

# Log configuration for debugging
logger.info(f"Celery broker URL: {settings.CELERY_BROKER_URL}")
logger.info(f"Celery result backend: {settings.CELERY_RESULT_BACKEND}")
