from telegram import Update
from telegram.ext import ContextTypes

from alert_bot.auth import get_auth_session, get_subscriber, is_locked, reset_auth_session
from alert_bot.db.session import SessionLocal
from alert_bot.keyboards import MAIN_KEYBOARD


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat is None or update.message is None:
        return
    chat_id = update.effective_chat.id
    db = SessionLocal()
    try:
        if get_subscriber(db, chat_id):
            await update.message.reply_text(
                "Вы уже авторизованы. Уведомления об ошибках включены.",
                reply_markup=MAIN_KEYBOARD,
            )
            return
        reset_auth_session(db, chat_id)
        await update.message.reply_text(
            "SvoyGarage Alert Bot.\n\n"
            "Для получения уведомлений об ошибках сервера введите email администратора:",
            reply_markup=None,
        )
    finally:
        db.close()
