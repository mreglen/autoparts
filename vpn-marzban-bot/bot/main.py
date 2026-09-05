"""
Публичный Telegram-бот: выдаёт VLESS-ключи через Marzban API.
Стек: aiogram 3.x + httpx. Без регистрации, платежей и whitelist.
"""

from __future__ import annotations

import asyncio
import logging
import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from aiogram import Bot, Dispatcher, F
from aiogram.client.session.aiohttp import AiohttpSession
from aiogram.filters import CommandStart
from aiogram.types import (
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("marzban-vpn-bot")


@dataclass(frozen=True)
class Settings:
    bot_token: str
    marzban_base_url: str
    marzban_username: str
    marzban_password: str
    inbound_tag: str
    data_limit_gb: float
    expire_days: int
    cooldown_seconds: int
    telegram_proxy_url: str

    @classmethod
    def from_env(cls) -> "Settings":
        token = os.getenv("BOT_TOKEN", "").strip()
        if not token:
            raise RuntimeError("BOT_TOKEN не задан в .env")

        base = os.getenv("MARZBAN_BASE_URL", "http://127.0.0.1:62050").rstrip("/")
        username = os.getenv("MARZBAN_USERNAME", "").strip()
        password = os.getenv("MARZBAN_PASSWORD", "").strip()
        if not username or not password:
            raise RuntimeError("MARZBAN_USERNAME / MARZBAN_PASSWORD не заданы в .env")

        return cls(
            bot_token=token,
            marzban_base_url=base,
            marzban_username=username,
            marzban_password=password,
            inbound_tag=os.getenv("INBOUND_TAG", "VLESS TCP REALITY").strip(),
            data_limit_gb=float(os.getenv("DATA_LIMIT_GB", "50")),
            expire_days=int(os.getenv("EXPIRE_DAYS", "30")),
            cooldown_seconds=int(os.getenv("COOLDOWN_SECONDS", "60")),
            # На многих VPS api.telegram.org недоступен напрямую — используем Tor (как alert-bot)
            telegram_proxy_url=os.getenv(
                "TELEGRAM_PROXY_URL", "socks5://127.0.0.1:9050"
            ).strip(),
        )


# Антифлуд в памяти процесса (не авторизация — только защита API от спама)
_last_issue_at: dict[int, float] = {}


# ---------------------------------------------------------------------------
# Marzban API
# ---------------------------------------------------------------------------


class MarzbanClient:
    """Минимальный клиент Marzban REST API для создания пользователей."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._token: str | None = None
        self._token_expires_at: float = 0.0
        self._client = httpx.AsyncClient(
            base_url=settings.marzban_base_url,
            timeout=30.0,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get_token(self) -> str:
        # Переиспользуем токен ~50 минут (типичный JWT Marzban живёт дольше)
        now = time.time()
        if self._token and now < self._token_expires_at:
            return self._token

        response = await self._client.post(
            "/api/admin/token",
            data={
                "username": self._settings.marzban_username,
                "password": self._settings.marzban_password,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if response.status_code != 200:
            logger.error(
                "Ошибка получения токена Marzban: %s %s",
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Не удалось авторизоваться в Marzban (HTTP {response.status_code})"
            )

        payload = response.json()
        access_token = payload.get("access_token")
        if not access_token:
            raise RuntimeError("Marzban не вернул access_token")

        self._token = access_token
        self._token_expires_at = now + 50 * 60
        return access_token

    async def create_user(self, username: str) -> dict[str, Any]:
        """Создаёт пользователя VLESS Reality и возвращает JSON ответа API."""
        token = await self._get_token()

        data_limit_bytes = 0
        if self._settings.data_limit_gb > 0:
            data_limit_bytes = int(self._settings.data_limit_gb * (1024**3))

        expire_ts = 0
        if self._settings.expire_days > 0:
            expire_ts = int(time.time()) + self._settings.expire_days * 86400

        body: dict[str, Any] = {
            "username": username,
            "proxies": {
                "vless": {
                    "flow": "xtls-rprx-vision",
                }
            },
            "inbounds": {
                "vless": [self._settings.inbound_tag],
            },
            "expire": expire_ts,
            "data_limit": data_limit_bytes,
            "data_limit_reset_strategy": "no_reset",
            "status": "active",
            "note": "issued-by-public-telegram-bot",
        }

        response = await self._client.post(
            "/api/user",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
        )

        # Если токен протух — один повтор
        if response.status_code == 401:
            self._token = None
            token = await self._get_token()
            response = await self._client.post(
                "/api/user",
                json=body,
                headers={"Authorization": f"Bearer {token}"},
            )

        if response.status_code not in (200, 201):
            logger.error(
                "Ошибка создания пользователя: %s %s",
                response.status_code,
                response.text,
            )
            raise RuntimeError(
                f"Marzban отклонил создание пользователя (HTTP {response.status_code})"
            )

        return response.json()


def build_username(telegram_user_id: int) -> str:
    """
    Уникальный username для Marzban.
    Правила: 3–32 символа, a-z, 0-9, подчёркивания.
    """
    suffix = secrets.token_hex(3)
    raw = f"tg_{telegram_user_id}_{suffix}"
    # На всякий случай обрезаем до 32 символов
    return raw[:32]


def extract_vless_links(user_payload: dict[str, Any]) -> list[str]:
    """Все vless:// ссылки из ответа Marzban (по одной на Host / локацию)."""
    links = user_payload.get("links") or []
    result: list[str] = []
    for link in links:
        if isinstance(link, str) and link.startswith("vless://"):
            result.append(link)
    return result


def extract_subscription_url(user_payload: dict[str, Any]) -> str | None:
    url = user_payload.get("subscription_url")
    if isinstance(url, str) and url.strip():
        # Panel is localhost-only; public sub proxy listens on :2086
        return url.strip().replace(
            "://195.24.65.251:62050",
            "://195.24.65.251:2086",
        )
    return None


def _html_code(value: str) -> str:
    """Экранирование для HTML parse_mode Telegram (надёжнее Markdown для длинных URL)."""
    escaped = (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    return f"<code>{escaped}</code>"


def _remark_from_vless(link: str) -> str:
    """Имя профиля после # (флаг + локация), если есть."""
    if "#" not in link:
        return "VPN"
    from urllib.parse import unquote

    return unquote(link.rsplit("#", 1)[-1]) or "VPN"


def format_success_message(
    vless_links: list[str],
    subscription_url: str | None,
    username: str,
) -> str:
    parts: list[str] = [
        "✅ Ваш VPN-ключ готов.",
        f"Пользователь Marzban: {_html_code(username)}",
        "",
    ]

    if vless_links:
        parts.append(f"🔑 Локации ({len(vless_links)}) — скопируйте нужную или все:")
        parts.append("")
        for idx, link in enumerate(vless_links, start=1):
            remark = _remark_from_vless(link)
            parts.append(f"{idx}. <b>{remark}</b>")
            parts.append(_html_code(link))
            parts.append("")

    if subscription_url:
        parts.extend(
            [
                "📎 Ссылка подписки (все локации сразу, лучше для Happ):",
                _html_code(subscription_url),
                "",
            ]
        )

    if not vless_links and not subscription_url:
        parts.append(
            "⚠️ Ключ создан, но ссылка не найдена в ответе API. "
            "Проверьте Host Settings в панели Marzban."
        )
        return "\n".join(parts)

    parts.extend(
        [
            "📱 Как импортировать в Happ VPN:",
            "1. Предпочтительно: скопируйте ссылку подписки выше → Happ → вставить.",
            "2. Или скопируйте каждый vless:// ключ локации и вставьте по очереди.",
            "3. В списке серверов должны появиться профили с флагами (🇷🇺 / 🇩🇪).",
            "",
            "Если видна только одна страна — обновите подписку в Happ (потянуть вниз / Update).",
        ]
    )
    return "\n".join(parts)


def main_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Получить ключ VPN",
                    callback_data="get_vpn_key",
                )
            ]
        ]
    )


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


async def cmd_start(message: Message) -> None:
    await message.answer(
        "👋 Публичный VPN-бот на базе Marzban (VLESS Reality).\n\n"
        "Нажмите кнопку ниже — бот создаст уникальный ключ и отправит его вам.\n"
        "Ключ совместим с Happ VPN.",
        reply_markup=main_keyboard(),
    )


async def on_get_vpn_key(
    callback: CallbackQuery,
    marzban: MarzbanClient,
    settings: Settings,
) -> None:
    if callback.from_user is None:
        await callback.answer("Не удалось определить пользователя.", show_alert=True)
        return

    user_id = callback.from_user.id
    now = time.time()
    last = _last_issue_at.get(user_id, 0.0)
    remaining = settings.cooldown_seconds - (now - last)
    if remaining > 0:
        await callback.answer(
            f"Подождите ещё {int(remaining)} сек. перед следующим запросом.",
            show_alert=True,
        )
        return

    await callback.answer("Создаю ключ…")

    username = build_username(user_id)
    try:
        user_payload = await marzban.create_user(username)
    except Exception as exc:
        logger.exception("Ошибка выдачи ключа для tg=%s", user_id)
        if callback.message:
            await callback.message.answer(
                f"❌ Не удалось создать ключ: {exc}\n"
                "Попробуйте позже или обратитесь к администратору сервера."
            )
        return

    _last_issue_at[user_id] = now

    vless_links = extract_vless_links(user_payload)
    subscription_url = extract_subscription_url(user_payload)
    text = format_success_message(vless_links, subscription_url, username)

    if callback.message:
        # Telegram лимит ~4096 символов; при многих локациях режем на части
        if len(text) <= 4000:
            await callback.message.answer(text, parse_mode="HTML")
        else:
            chunks: list[str] = []
            buf = ""
            for line in text.split("\n"):
                if len(buf) + len(line) + 1 > 3900:
                    chunks.append(buf)
                    buf = line
                else:
                    buf = f"{buf}\n{line}" if buf else line
            if buf:
                chunks.append(buf)
            for chunk in chunks:
                await callback.message.answer(chunk, parse_mode="HTML")
        await callback.message.answer(
            "Нужен ещё один ключ? Нажмите кнопку ниже.",
            reply_markup=main_keyboard(),
        )


async def main() -> None:
    settings = Settings.from_env()
    marzban = MarzbanClient(settings)

    session = None
    if settings.telegram_proxy_url:
        # socks5 требует пакет aiohttp-socks
        session = AiohttpSession(proxy=settings.telegram_proxy_url)
        logger.info("Telegram proxy: %s", settings.telegram_proxy_url)

    bot = Bot(token=settings.bot_token, session=session)
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def _start(message: Message) -> None:
        await cmd_start(message)

    @dp.callback_query(F.data == "get_vpn_key")
    async def _get_key(callback: CallbackQuery) -> None:
        await on_get_vpn_key(callback, marzban, settings)

    logger.info(
        "Бот запускается. Marzban=%s inbound=%r",
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
