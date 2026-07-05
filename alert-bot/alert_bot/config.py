import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Local dev
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# CLI / cron (root): read prod env if accessible; systemd service uses EnvironmentFile
_prod_env = Path("/etc/autoparts/alert-bot.env")
if _prod_env.is_file() and os.access(_prod_env, os.R_OK):
    load_dotenv(_prod_env)


@dataclass(frozen=True)
class Settings:
    bot_token: str
    database_url: str
    alert_cooldown_sec: int
    history_page_size: int = 5
    max_auth_failures: int = 3
    auth_lockout_sec: int = 900


def get_settings() -> Settings:
    token = os.getenv("BOT_TOKEN", "").strip()
    db_url = os.getenv("DATABASE_URL", "").strip()
    if not token:
        raise RuntimeError("BOT_TOKEN is required")
    if not db_url:
        raise RuntimeError("DATABASE_URL is required")
    return Settings(
        bot_token=token,
        database_url=db_url,
        alert_cooldown_sec=int(os.getenv("ALERT_COOLDOWN_SEC", "300")),
    )
