import asyncio
import logging

from telegram.ext import CallbackQueryHandler, CommandHandler, MessageHandler, filters

from alert_bot.config import get_settings
from alert_bot.telegram_client import build_application
from alert_bot.db.models import Base
from alert_bot.db.session import engine
from alert_bot.handlers.history import history_callback
from alert_bot.handlers.menu import handle_text
from alert_bot.handlers.start import start_command
from alert_bot.services.log_collector import run_log_collector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured")


async def _post_init(application) -> None:
    settings = get_settings()
    bot = application.bot
    asyncio.create_task(run_log_collector(bot, settings))


def main() -> None:
    settings = get_settings()
    init_db()

    app = build_application(settings, post_init=_post_init)

    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(CallbackQueryHandler(history_callback, pattern=r"^history:"))

    logger.info("Starting SvoyGarage alert bot polling + log collector")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
