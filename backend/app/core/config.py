from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

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
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    
    # Пути к FFmpeg для обработки видео
    FFPROBE_PATH: Optional[str] = r"C:\ffmpeg\bin\ffprobe.exe"
    FFMPEG_PATH: Optional[str] = r"C:\ffmpeg\bin\ffmpeg.exe"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra='ignore')

settings = Settings()