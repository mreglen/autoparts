"""
Точка входа Telegram-бота (aiogram 3.x).
systemd: WorkingDirectory=/opt/marzban-vpn-bot → python main.py
"""

from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path

# Позволяет импортировать модули при запуске `python main.py` из каталога bot/
sys.path.insert(0, str(Path(__file__).resolve().parent))

from aiogram import Bot, Dispatcher
from aiogram.client.session.aiohttp import AiohttpSession

from config import get_settings
from db import create_tables, init_db, session_factory
from handlers import register_handlers
from marzban_api import MarzbanClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("marzban-vpn-bot")


async def main() -> None:
    settings = get_settings()
    init_db(settings)
    await create_tables()

    marzban = MarzbanClient(settings)
    session = None
    if settings.telegram_proxy_url:
        session = AiohttpSession(proxy=settings.telegram_proxy_url)
        logger.info("Telegram proxy: %s", settings.telegram_proxy_url)

    bot = Bot(token=settings.bot_token, session=session)
    dp = Dispatcher()
    dp.include_router(
        register_handlers(
            settings=settings,
            marzban=marzban,
            session_maker=session_factory(),
        )
    )

    logger.info(
        "Бот запускается. Marzban=%s inbound=%r DB ok",
        settings.marzban_base_url,
        settings.inbound_tag,
    )

    try:
        await dp.start_polling(bot)
    finally:
        await marzban.aclose()
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
