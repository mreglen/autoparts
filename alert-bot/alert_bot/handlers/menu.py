import subprocess

from telegram import Update
from telegram.ext import ContextTypes

from alert_bot.auth import (
    activate_subscriber,
    deactivate_subscriber,
    find_admin_by_email,
    get_auth_session,
    get_subscriber,
    is_locked,
    is_valid_email,
    register_failure,
    reset_auth_session,
    verify_password,
)
from alert_bot.config import get_settings
from alert_bot.db.models import ServerErrorEvent, utcnow
from alert_bot.db.session import SessionLocal
from alert_bot.handlers.history import send_history_page
from alert_bot.keyboards import MAIN_KEYBOARD

SERVICES = ("kroan", "nginx", "postgresql", "redis-server", "celery", "pgbouncer")


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_chat is None or update.message is None or update.message.text is None:
        return
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    settings = get_settings()
    db = SessionLocal()
    try:
        if get_subscriber(db, chat_id):
            await _handle_authenticated(update, text, db)
            return

        session = get_auth_session(db, chat_id)
        if is_locked(session):
            await update.message.reply_text(
                "Слишком много неудачных попыток. Попробуйте позже или отправьте /start."
            )
            return

        if session.state == "awaiting_email":
            if not is_valid_email(text):
                await update.message.reply_text("Некорректный email. Введите email администратора:")
                return
            admin = find_admin_by_email(db, text)
            if admin is None:
                locked = register_failure(db, session, settings)
                if locked:
                    await update.message.reply_text("Доступ заблокирован на 15 минут.")
                else:
                    await update.message.reply_text(
                        "Администратор с таким email не найден. Попробуйте снова или /start."
                    )
                return
            session.email_temp = text
            session.state = "awaiting_password"
            session.updated_at = utcnow()
            db.commit()
            await update.message.reply_text("Введите пароль:")
            return

        if session.state == "awaiting_password":
            admin = find_admin_by_email(db, session.email_temp or "")
            if admin is None or not verify_password(text, admin.hashed_password):
                try:
                    await update.message.delete()
                except Exception:
                    pass
                locked = register_failure(db, session, settings)
                if locked:
                    await update.message.reply_text("Доступ заблокирован на 15 минут.")
                else:
                    await update.message.reply_text("Неверный пароль. Попробуйте снова или /start.")
                return
            try:
                await update.message.delete()
            except Exception:
                pass
            activate_subscriber(db, chat_id, admin.id)
            await update.message.reply_text(
                f"Авторизация успешна, {admin.email}.\n"
                "Вы будете получать уведомления об ошибках сервера.",
                reply_markup=MAIN_KEYBOARD,
            )
            return

        reset_auth_session(db, chat_id)
        await update.message.reply_text("Отправьте /start для авторизации.")
    finally:
        db.close()


async def _handle_authenticated(update: Update, text: str, db) -> None:
    chat_id = update.effective_chat.id
    if text == "📋 История ошибок":
        await send_history_page(update, db, page=0)
        return
    if text == "📊 Статус":
        await _send_status(update, db)
        return
    if text == "🚪 Выйти":
        deactivate_subscriber(db, chat_id)
        await update.message.reply_text(
            "Вы вышли. Уведомления отключены. Для повторного входа отправьте /start.",
            reply_markup=None,
        )
        return
    await update.message.reply_text("Используйте кнопки меню или /start.", reply_markup=MAIN_KEYBOARD)


async def _send_status(update: Update, db) -> None:
    lines = ["📊 Статус сервера\n"]
    for svc in SERVICES:
        try:
            result = subprocess.run(
                ["systemctl", "is-active", svc],
                capture_output=True,
                text=True,
                timeout=5,
            )
            status = result.stdout.strip() or "unknown"
        except Exception:
            status = "unknown"
        icon = "✅" if status == "active" else "❌"
        lines.append(f"{icon} {svc}: {status}")

    last = (
        db.query(ServerErrorEvent)
        .order_by(ServerErrorEvent.created_at.desc())
        .first()
    )
    if last:
        ts = last.created_at.strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"\nПоследняя ошибка: {ts} | {last.source} | {last.title}")
    else:
        lines.append("\nОшибок в базе пока нет.")

    await update.message.reply_text("\n".join(lines), reply_markup=MAIN_KEYBOARD)
