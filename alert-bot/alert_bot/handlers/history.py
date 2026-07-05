from math import ceil

from telegram import Update
from telegram.ext import ContextTypes

from alert_bot.config import get_settings
from alert_bot.db.models import ServerErrorEvent
from alert_bot.db.session import SessionLocal
from alert_bot.keyboards import MAIN_KEYBOARD, history_keyboard


def _format_event(event: ServerErrorEvent) -> str:
    ts = event.created_at.strftime("%Y-%m-%d %H:%M")
    sev = {"critical": "🔴", "error": "🟠", "warning": "🟡", "info": "🔵"}.get(event.severity, "⚪")
    msg = event.message.replace("\n", " ")
    if len(msg) > 120:
        msg = msg[:117] + "..."
    return f"{sev} `{ts}` | {event.source} | {event.title}\n{msg}"


async def send_history_page(update: Update, db, page: int = 0) -> None:
    settings = get_settings()
    page_size = settings.history_page_size
    total = db.query(ServerErrorEvent).count()
    total_pages = max(1, ceil(total / page_size))
    page = max(0, min(page, total_pages - 1))

    events = (
        db.query(ServerErrorEvent)
        .order_by(ServerErrorEvent.created_at.desc())
        .offset(page * page_size)
        .limit(page_size)
        .all()
    )

    if not events:
        text = "История ошибок пуста."
    else:
        lines = [f"📋 История ошибок (стр. {page + 1}/{total_pages})\n"]
        lines.extend(_format_event(e) for e in events)
        text = "\n\n".join(lines)

    keyboard = history_keyboard(page, total_pages)
    message = update.message or (update.callback_query.message if update.callback_query else None)
    if message is None:
        return
    await message.reply_text(text, reply_markup=keyboard or MAIN_KEYBOARD, parse_mode="Markdown")


async def history_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if query is None or query.data is None:
        return
    await query.answer()
    if not query.data.startswith("history:"):
        return
    page = int(query.data.split(":", 1)[1])
    db = SessionLocal()
    try:
        settings = get_settings()
        page_size = settings.history_page_size
        total = db.query(ServerErrorEvent).count()
        total_pages = max(1, ceil(total / page_size))
        page = max(0, min(page, total_pages - 1))

        events = (
            db.query(ServerErrorEvent)
            .order_by(ServerErrorEvent.created_at.desc())
            .offset(page * page_size)
            .limit(page_size)
            .all()
        )
        if not events:
            text = "История ошибок пуста."
        else:
            lines = [f"📋 История ошибок (стр. {page + 1}/{total_pages})\n"]
            lines.extend(_format_event(e) for e in events)
            text = "\n\n".join(lines)
        keyboard = history_keyboard(page, total_pages)
        await query.edit_message_text(text, reply_markup=keyboard, parse_mode="Markdown")
    finally:
        db.close()
