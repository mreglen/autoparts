"""Хендлеры aiogram 3.x: /start, главное меню, ключ, рефералка."""

from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.filters import CommandStart
from aiogram.types import CallbackQuery, Message
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from config import Settings
from db import get_user
from keyboards import back_to_menu_keyboard, main_menu_keyboard
from marzban_api import MarzbanClient
from services import ensure_real_crypto_link, ensure_registered
from utils import format_remaining, html_code, parse_referral_payload, utcnow
from happ_crypto import generate_happ_add_link, decode_happ_crypt4

logger = logging.getLogger("marzban-vpn-bot.handlers")

router = Router(name="marzvpn")


def format_main_menu(telegram_id: int, expire_at) -> str:
    remaining = format_remaining(expire_at, utcnow())
    return (
        f"<b>Аккаунт ID</b> {html_code(str(telegram_id))}\n\n"
        f"<b>Ключ истекает через:</b>\n"
        f"{html_code(remaining)}\n\n"
        "🙋‍♀️ Пригласи друга и получи +5 дней нашего сервиса"
    )


HOW_TO_SETUP = (
    "<b>Как настроить Happ VPN</b>\n\n"
    "1. Установите приложение <b>Happ</b> (iOS / Android).\n"
    "2. Откройте бота → <b>🔑 Ключ</b> → нажмите на код "
    "<code>happ://crypt4/...</code> (скопируется).\n"
    "3. В Happ вставьте ссылку из буфера.\n"
    "4. В списке серверов выберите локацию (🇷🇺 / 🇩🇪).\n\n"
    "После продления подписки в Happ нажмите «Обновить» — "
    "ключ менять не нужно."
)


def register_handlers(
    *,
    settings: Settings,
    marzban: MarzbanClient,
    session_maker: async_sessionmaker[AsyncSession],
) -> Router:
    @router.message(CommandStart())
    async def cmd_start(message: Message) -> None:
        if message.from_user is None:
            return

        telegram_id = message.from_user.id
        referrer_id = parse_referral_payload(message.text)

        async with session_maker() as session:
            try:
                user, created, rewarded = await ensure_registered(
                    session,
                    marzban,
                    settings,
                    telegram_id=telegram_id,
                    username=message.from_user.username,
                    referrer_id=referrer_id,
                )
            except Exception as exc:
                logger.exception("Ошибка регистрации tg=%s", telegram_id)
                await message.answer(
                    f"❌ Не удалось создать аккаунт: {exc}\nПопробуйте позже."
                )
                return

        text = format_main_menu(user.telegram_id, user.expire_at)
        if created:
            text = (
                "✅ Аккаунт создан. Тестовый период активирован.\n\n" + text
            )
        if rewarded:
            text += (
                f"\n\n🎁 Пригласившему вас пользователю начислено "
                f"+{settings.referral_reward_days} дней."
            )

        await message.answer(
            text,
            parse_mode="HTML",
            reply_markup=main_menu_keyboard(),
            disable_web_page_preview=True,
        )

    @router.callback_query(F.data == "back_to_menu")
    async def on_back_to_menu(callback: CallbackQuery) -> None:
        if callback.from_user is None:
            await callback.answer()
            return

        async with session_maker() as session:
            user = await get_user(session, callback.from_user.id)

        if user is None:
            await callback.answer("Сначала нажмите /start", show_alert=True)
            return

        await callback.answer()
        text = format_main_menu(user.telegram_id, user.expire_at)
        if callback.message:
            await callback.message.answer(
                text,
                parse_mode="HTML",
                reply_markup=main_menu_keyboard(),
                disable_web_page_preview=True,
            )

    @router.callback_query(F.data == "show_key")
    async def on_show_key(callback: CallbackQuery) -> None:
        if callback.from_user is None:
            await callback.answer()
            return

        async with session_maker() as session:
            user = await get_user(session, callback.from_user.id)
            if user is not None:
                user = await ensure_real_crypto_link(session, user, marzban)

        if user is None:
            await callback.answer("Сначала нажмите /start", show_alert=True)
            return

        await callback.answer()
        sub_url = decode_happ_crypt4(user.crypt4_link) or user.subscription_url
        add_link = generate_happ_add_link(sub_url)
        text = (
            "<b>КЛЮЧ ДОСТУПА ДЛЯ HAPP</b>\n\n"
            "<b>1) Рекомендуется (открыть в Happ):</b>\n"
            f"{html_code(add_link)}\n\n"
            "<b>2) crypt4:</b>\n"
            f"{html_code(user.crypt4_link)}\n\n"
            "<b>3) Прямая подписка (если deeplink не сработал):</b>\n"
            f"{html_code(sub_url)}\n\n"
            "<i>Нажмите на код, чтобы скопировать. В Happ: добавить подписку / вставить.</i>"
        )
        if callback.message:
            await callback.message.answer(
                text,
                parse_mode="HTML",
                reply_markup=back_to_menu_keyboard(),
                disable_web_page_preview=True,
            )

    @router.callback_query(F.data == "invite_friend")
    async def on_invite(callback: CallbackQuery) -> None:
        if callback.from_user is None:
            await callback.answer()
            return

        tg_id = callback.from_user.id
        link = f"https://t.me/{settings.bot_username}?start=ref_{tg_id}"
        text = (
            "Ваша реферальная ссылка:\n"
            f"{html_code(link)}\n\n"
            "Делитесь ссылкой с друзьями! За каждого приглашенного друга "
            f"вы получаете +{settings.referral_reward_days} дней подписки."
        )
        await callback.answer()
        if callback.message:
            await callback.message.answer(
                text,
                parse_mode="HTML",
                reply_markup=back_to_menu_keyboard(),
                disable_web_page_preview=True,
            )

    @router.callback_query(F.data == "how_to_setup")
    async def on_how_to(callback: CallbackQuery) -> None:
        await callback.answer()
        if callback.message:
            await callback.message.answer(
                HOW_TO_SETUP,
                parse_mode="HTML",
                reply_markup=back_to_menu_keyboard(),
                disable_web_page_preview=True,
            )

    return router
