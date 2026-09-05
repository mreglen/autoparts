"""Инлайн-клавиатуры главного меню."""

from __future__ import annotations

from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🔗 Пригласить друга (+5 дней)",
                    callback_data="invite_friend",
                )
            ],
            [
                InlineKeyboardButton(
                    text="🔑 Ключ",
                    callback_data="show_key",
                )
            ],
            [
                InlineKeyboardButton(
                    text="❓ Как настроить?",
                    callback_data="how_to_setup",
                )
            ],
        ]
    )


def back_to_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="⬅️ Назад в меню",
                    callback_data="back_to_menu",
                )
            ]
        ]
    )
