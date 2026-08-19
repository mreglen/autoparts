from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    APP_ENV: str = "production"
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int  
    EMAIL_HOST: str
    EMAIL_PORT: int 
    EMAIL_HOST_USER: str
    EMAIL_HOST_PASSWORD: str
    EMAIL_FROM: str
    VERIFICATION_CODE_EXPIRE_SECONDS: int
    ROSSKO_KEY1: Optional[str] = None
    ROSSKO_KEY2: Optional[str] = None
    GET_SEARCH: str
    GET_CHECK_OUT_DETAILS: str
    GET_CHECK_OUT: str
    GET_ORDERS: str
    GET_DELIVERY_DETAILS: str
    GET_SETTLEMETNS: str
    GET_BROKEN_WAVE: str
    BASE_URL: str  # Для внутренних API вызовов (localhost)
    PUBLIC_BASE_URL: str  # Для фронтенда и внешних ссылок
    # Comma-separated list of allowed CORS origins.
    # Example: "https://app.example.com,https://www.example.com"
    CORS_ALLOW_ORIGINS: Optional[str] = None
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    # Ключ для Fernet-шифрования client_secret Авито (32+ байт лучше; иначе берётся SHA256 от строки).
    # Если не задан — используется SECRET_KEY (менее желательно для прода).
    AVITO_CREDENTIALS_SECRET: Optional[str] = None
    # Ключ для шифрования секретов и токенов интеграции Яндекс.
    # Если не задан — используется SECRET_KEY.
    YANDEX_CREDENTIALS_SECRET: Optional[str] = None
    # Redirect URI, зарегистрированный в OAuth приложении Яндекса.
    # Если не задан — формируется как {PUBLIC_BASE_URL}/api/admin/yandex/oauth/callback.
    YANDEX_OAUTH_REDIRECT_URI: Optional[str] = None
    YANDEX_OAUTH_AUTHORIZE_URL: str = "https://oauth.yandex.ru/authorize"
    YANDEX_OAUTH_TOKEN_URL: str = "https://oauth.yandex.ru/token"
    YANDEX_WEBMASTER_API_BASE: str = "https://api.webmaster.yandex.net/v4"

    GOOGLE_OAUTH_AUTHORIZE_URL: str = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_OAUTH_TOKEN_URL: str = "https://oauth2.googleapis.com/token"
    GOOGLE_OAUTH_REDIRECT_URI: Optional[str] = None
    GOOGLE_CREDENTIALS_SECRET: Optional[str] = None
    # Ключ для шифрования API-ключа OpenRouter в БД. Если не задан — SECRET_KEY.
    OPENROUTER_CREDENTIALS_SECRET: Optional[str] = None
    # Ключ для шифрования логина/пароля Laximo.CAT в БД. Если не задан — SECRET_KEY.
    LAXIMO_CREDENTIALS_SECRET: Optional[str] = None
    # Dev-fallback credentials (не основной путь; прод — /admin-settings).
    LAXIMO_CAT_LOGIN: Optional[str] = None
    LAXIMO_CAT_PASSWORD: Optional[str] = None
    LAXIMO_CAT_BASE: Optional[str] = None
    
    # Пути к FFmpeg для обработки видео
    FFPROBE_PATH: Optional[str] = r"C:\ffmpeg\bin\ffprobe.exe"
    FFMPEG_PATH: Optional[str] = r"C:\ffmpeg\bin\ffmpeg.exe"
    
    # VAPID Keys для Push Notifications
    VAPID_PUBLIC_KEY: Optional[str] = ""
    VAPID_PRIVATE_KEY: Optional[str] = ""

    # Опционально: общий секрет для POST /webhooks/avito/messenger (?secret= или заголовок X-Webhook-Secret)
    AVITO_WEBHOOK_SECRET: Optional[str] = None

    # ЮKassa (HTTP Basic: shopId + secret)
    YOOKASSA_SHOP_ID: Optional[str] = None
    YOOKASSA_SECRET_KEY: Optional[str] = None
    YANDEX_YOOKASSA_SECRET: Optional[str] = None  # legacy alias
    YOOKASSA_API_BASE: str = "https://api.yookassa.ru/v3"
    YOOKASSA_TAX_SYSTEM_CODE: int = 2
    YOOKASSA_DEFAULT_VAT_CODE: int = 1
    YOOKASSA_PAYMENT_TTL_MINUTES: int = 60

    # DaData (подсказки адреса)
    DADATA_API_KEY: Optional[str] = None

    # SEO sitemap: lastmod статического sitemap-pages.xml (обновлять при правке файла)
    SITEMAP_PAGES_LASTMOD: str = "2026-05-29"
    SITEMAP_REBUILD_HOUR_UTC: int = 3

    # SEO new parts: Rossko sync (создание карточек) и sitemap export
    NEW_PARTS_SEO_SYNC_DAILY_LIMIT: int = 1000
    NEW_PARTS_SEO_SYNC_NOT_FOUND_RETRY_DAYS: int = 7
    NEW_PARTS_SEO_SYNC_ROSSKO_DELAY_SEC: float = 0.2
    NEW_PARTS_SEO_SYNC_BATCH_INTERVAL_MINUTES: int = 30
    NEW_PARTS_SEO_SYNC_BATCH_SIZE: int = 0
    NEW_PARTS_SEO_SYNC_USE_CELERY: bool = True
    NEW_PARTS_SEO_MAX_CARDS_PER_RESPONSE: int = 5
    # 0 = все позиции с остатком из ответа Rossko (до SEED_EXTRACT_MAX_PARTS)
    NEW_PARTS_SEO_MAX_CARDS_PER_SEED_RESPONSE: int = 0
    NEW_PARTS_SEO_SEED_EXTRACT_MAX_PARTS: int = 500
    NEW_PARTS_SEO_MAX_CROSSES_PER_RESPONSE: int = 50
    NEW_PARTS_SEO_CROSS_RECURSE_DAILY: int = 500
    NEW_PARTS_SEO_CATCHUP_ENABLED: bool = True
    NEW_PARTS_SEO_CATCHUP_SLACK: int = 50
    NEW_PARTS_SEO_SEED_PRECHECK_DAILY: int = 3000
    NEW_PARTS_SEO_SEED_NOT_FOUND_RETRY_DAYS: int = 3
    NEW_PARTS_SEO_SEED_PRECHECK_INTERVAL_MINUTES: int = 30
    NEW_PARTS_SEO_SEED_POPULATE_LIMIT: int = 20000
    NEW_PARTS_SEO_SEED_TECDOC_LIMIT: int = 100000
    NEW_PARTS_SEO_SEED_READY_TARGET: int = 3000
    NEW_PARTS_SEO_TECDOC_HARVEST_BATCH: int = 10000
    NEW_PARTS_SEO_TECDOC_CROSS_BATCH: int = 5000
    SEO_SITEMAP_DAILY_URL_LIMIT: int = 500
    NEW_PARTS_SEO_REFRESH_BATCH_SIZE: int = 100
    NEW_PARTS_SEO_REFRESH_INTERVAL_HOURS: int = 6

    # DDoS / rate limiting
    RATE_LIMIT_ENABLED: bool = True
    PRERENDER_INTERNAL_TOKEN: Optional[str] = None
    API_DOCS_ENABLED: bool = False
    TRUSTED_PROXY_HOSTS: str = "127.0.0.1,::1"
    PRODUCTS_PUBLIC_CACHE_TTL_SECONDS: int = 45
    PRODUCT_DETAIL_CACHE_TTL_SECONDS: int = 120
    CATALOG_CACHE_TTL_SECONDS: int = 60
    CATALOG_FACETS_CACHE_TTL_SECONDS: int = 300
    USED_MATCH_CACHE_TTL_SECONDS: int = 120
    WEBSOCKET_MAX_CONNECTIONS_PER_USER: int = 5

    # SQLAlchemy pool per Gunicorn worker (2 workers → max ~40 DB connections)
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10

    # Резервные копии (БД и uploads)
    BACKUP_DIR: Optional[str] = None
    PG_DUMP_PATH: Optional[str] = None
    BACKUP_RETENTION_COUNT: int = 8
    BACKUP_WEEKLY_HOUR_UTC: int = 4

    # Autoservice planner daily digest (12:00 MSK = 09:00 UTC)
    AUTOSERVICE_PLANNER_DIGEST_HOUR_UTC: int = 9

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra='ignore')

    @property
    def yookassa_secret_key(self) -> Optional[str]:
        return (self.YOOKASSA_SECRET_KEY or self.YANDEX_YOOKASSA_SECRET or "").strip() or None

    @property
    def yookassa_configured(self) -> bool:
        return bool(self.YOOKASSA_SHOP_ID and self.yookassa_secret_key)

settings = Settings()