"""Конфигурация VPN Telegram-бота из переменных окружения."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    bot_token: str
    bot_username: str

    database_url: str

    marzban_base_url: str
    marzban_username: str
    marzban_password: str
    inbound_tag: str
    subscription_url_rewrite_from: str
    subscription_url_rewrite_to: str

    data_limit_gb: float
    trial_minutes: int
    referral_reward_days: int

    telegram_proxy_url: str

    celery_broker_url: str
    celery_result_backend: str
    key_verify_interval_minutes: int

    @classmethod
    def from_env(cls) -> "Settings":
        token = os.getenv("BOT_TOKEN", "").strip()
        if not token:
            raise RuntimeError("BOT_TOKEN не задан в .env")

        database_url = os.getenv("DATABASE_URL", "").strip()
        if not database_url:
            raise RuntimeError("DATABASE_URL не задан в .env")

        # async SQLAlchemy ожидает postgresql+asyncpg://
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace(
                "postgresql://", "postgresql+asyncpg://", 1
            )
        elif database_url.startswith("postgres://"):
            database_url = database_url.replace(
                "postgres://", "postgresql+asyncpg://", 1
            )

        username = os.getenv("MARZBAN_USERNAME", "").strip()
        password = os.getenv("MARZBAN_PASSWORD", "").strip()
        if not username or not password:
            raise RuntimeError("MARZBAN_USERNAME / MARZBAN_PASSWORD не заданы в .env")

        broker = os.getenv("CELERY_BROKER_URL", "redis://127.0.0.1:6379/2").strip()
        backend = os.getenv("CELERY_RESULT_BACKEND", broker).strip()

        return cls(
            bot_token=token,
            bot_username=os.getenv("BOT_USERNAME", "marzvpn_bot").strip().lstrip("@"),
            database_url=database_url,
            marzban_base_url=os.getenv(
                "MARZBAN_BASE_URL", "http://127.0.0.1:62050"
            ).rstrip("/"),
            marzban_username=username,
            marzban_password=password,
            inbound_tag=os.getenv("INBOUND_TAG", "VLESS TCP REALITY").strip(),
            subscription_url_rewrite_from=os.getenv(
                "SUB_URL_REWRITE_FROM", "://195.24.65.251:62050"
            ).strip(),
            subscription_url_rewrite_to=os.getenv(
                "SUB_URL_REWRITE_TO", "://195.24.65.251:2086"
            ).strip(),
            data_limit_gb=float(os.getenv("DATA_LIMIT_GB", "50")),
            # Тест: TRIAL_MINUTES=10; прод: TRIAL_MINUTES=4320 (3 дня)
            trial_minutes=int(os.getenv("TRIAL_MINUTES", "4320")),
            referral_reward_days=int(os.getenv("REFERRAL_REWARD_DAYS", "5")),
            telegram_proxy_url=os.getenv(
                "TELEGRAM_PROXY_URL", "socks5://127.0.0.1:9050"
            ).strip(),
            celery_broker_url=broker,
            celery_result_backend=backend,
            key_verify_interval_minutes=int(
                os.getenv("KEY_VERIFY_INTERVAL_MINUTES", "5")
            ),
        )


def get_settings() -> Settings:
    return Settings.from_env()
