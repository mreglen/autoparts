from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
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
    ROSSKO_KEY1: str
    ROSSKO_KEY2: str
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

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra='ignore')

    @property
    def yookassa_secret_key(self) -> Optional[str]:
        return (self.YOOKASSA_SECRET_KEY or self.YANDEX_YOOKASSA_SECRET or "").strip() or None

    @property
    def yookassa_configured(self) -> bool:
        return bool(self.YOOKASSA_SHOP_ID and self.yookassa_secret_key)

settings = Settings()