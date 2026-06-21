from celery import Celery
from celery.schedules import crontab
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

celery_app = Celery(
    'autoparts',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        'app.tasks.photo_tasks',
        'app.tasks.video_tasks',
        'app.tasks.avito_tasks',
        'app.tasks.chat_media_tasks',
        'app.tasks.yandex_feed_tasks',
        'app.tasks.seo_tasks',
        'app.tasks.analytics_tasks',
    ]
)


celery_app.conf.update(
    broker_url=settings.CELERY_BROKER_URL,
    result_backend=settings.CELERY_RESULT_BACKEND,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # Увеличено до 10 минут для обработки видео
    worker_prefetch_multiplier=1,  # Брать по 1 задаче на воркер (важно для больших задач!)
    broker_transport_options={
        'visibility_timeout': 3600,
        'socket_connect_timeout': 3,
        'socket_timeout': 3,
    },
    broker_connection_retry_on_startup=True,
    # HIGH PERFORMANCE OPTIMIZATIONS
    worker_max_tasks_per_child=50,  # Перезапускать воркеры каждые 50 задач (предотвращает утечки памяти)
    task_acks_late=True,  # Подтверждать задачи ПОСЛЕ выполнения (надежность)
    task_reject_on_worker_lost=True,  # Повторять при падении воркера
    worker_send_task_events=True,  # Отправлять события для мониторинга
    # Оптимизация для параллельной обработки
    task_compression='gzip',  # Сжимать данные задач (быстрее передача)
    result_expires=3600,  # Истечение результатов через 1 час (экономия памяти)
    broker_pool_limit=100,  # Увеличить пул соединений с брокером
    beat_schedule={
        "analytics-monthly-query-review": {
            "task": "analytics.run_monthly_query_review",
            "schedule": crontab(day_of_month=1, hour=3, minute=0),
        },
    },
)


logger.info(f"Celery broker URL: {settings.CELERY_BROKER_URL}")
logger.info(f"Celery result: {settings.CELERY_RESULT_BACKEND}")
