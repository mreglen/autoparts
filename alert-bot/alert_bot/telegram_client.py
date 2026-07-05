from collections.abc import Awaitable, Callable
from typing import Any

from telegram import Bot
from telegram.ext import Application
from telegram.request import HTTPXRequest

from alert_bot.config import Settings


def _build_request(settings: Settings) -> HTTPXRequest:
    kwargs = {
        "connect_timeout": 30.0,
        "read_timeout": 30.0,
        "write_timeout": 30.0,
        "pool_timeout": 30.0,
    }
    if settings.telegram_proxy_url:
        kwargs["proxy"] = settings.telegram_proxy_url
    return HTTPXRequest(**kwargs)


def build_application(
    settings: Settings,
    post_init: Callable[[Application], Awaitable[None]] | None = None,
) -> Application:
    request = _build_request(settings)
    builder = (
        Application.builder()
        .token(settings.bot_token)
        .request(request)
        .get_updates_request(_build_request(settings))
    )
    if settings.telegram_api_base_url:
        base = settings.telegram_api_base_url.rstrip("/")
        builder = builder.base_url(f"{base}/bot").base_file_url(f"{base}/file/bot")
    if post_init is not None:
        builder = builder.post_init(post_init)
    return builder.build()


def build_bot(settings: Settings) -> Bot:
    kwargs: dict[str, Any] = {"request": _build_request(settings)}
    if settings.telegram_api_base_url:
        base = settings.telegram_api_base_url.rstrip("/")
        kwargs["base_url"] = f"{base}/bot"
    return Bot(settings.bot_token, **kwargs)
