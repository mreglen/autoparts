import hashlib
import logging
from datetime import timedelta

from sqlalchemy.orm import Session
from telegram import Bot
from telegram.constants import ParseMode

from alert_bot.config import Settings
from alert_bot.db.models import AlertBotSubscriber, ServerErrorEvent, utcnow

logger = logging.getLogger(__name__)

SEVERITY_EMOJI = {
    "critical": "🔴",
    "error": "🟠",
    "warning": "🟡",
    "info": "🔵",
}


def make_dedupe_key(source: str, title: str, message: str) -> str:
    normalized = f"{source}|{title}|{message.strip()[:500]}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:64]


def _should_notify(db: Session, dedupe_key: str, cooldown_sec: int) -> bool:
    cutoff = utcnow() - timedelta(seconds=cooldown_sec)
    recent = (
        db.query(ServerErrorEvent)
        .filter(ServerErrorEvent.dedupe_key == dedupe_key, ServerErrorEvent.created_at >= cutoff)
        .first()
    )
    return recent is None


def format_alert_message(event: ServerErrorEvent) -> str:
    emoji = SEVERITY_EMOJI.get(event.severity, "⚪")
    ts = event.created_at.strftime("%Y-%m-%d %H:%M:%S")
    text = f"{emoji} <b>{event.source}</b> | {event.severity}\n"
    text += f"<i>{ts}</i>\n"
    text += f"<b>{event.title}</b>\n"
    body = event.message
    if len(body) > 3500:
        body = body[:3497] + "..."
    text += body
    return text


def record_alert(
    db: Session,
    *,
    source: str,
    severity: str,
    title: str,
    message: str,
    dedupe_key: str | None = None,
    meta: dict | None = None,
    settings: Settings,
) -> tuple[ServerErrorEvent | None, bool]:
    """Insert alert if not in cooldown. Returns (event, should_notify)."""
    key = dedupe_key or make_dedupe_key(source, title, message)
    notify = _should_notify(db, key, settings.alert_cooldown_sec)
    if not notify:
        return None, False

    event = ServerErrorEvent(
        source=source,
        severity=severity,
        title=title,
        message=message,
        meta=meta,
        dedupe_key=key,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event, True


async def notify_subscribers(bot: Bot, db: Session, event: ServerErrorEvent) -> int:
    subscribers = (
        db.query(AlertBotSubscriber)
        .filter(AlertBotSubscriber.is_active.is_(True))
        .all()
    )
    if not subscribers:
        return 0

    text = format_alert_message(event)
    sent = 0
    for sub in subscribers:
        try:
            await bot.send_message(
                chat_id=sub.telegram_chat_id,
                text=text,
                parse_mode=ParseMode.HTML,
                disable_web_page_preview=True,
            )
            sent += 1
        except Exception as exc:
            logger.warning("Failed to notify chat_id=%s: %s", sub.telegram_chat_id, exc)
    return sent


async def record_and_notify(
    bot: Bot,
    db: Session,
    settings: Settings,
    *,
    source: str,
    severity: str,
    title: str,
    message: str,
    dedupe_key: str | None = None,
    meta: dict | None = None,
) -> ServerErrorEvent | None:
    event, notify = record_alert(
        db,
        source=source,
        severity=severity,
        title=title,
        message=message,
        dedupe_key=dedupe_key,
        meta=meta,
        settings=settings,
    )
    if event and notify:
        await notify_subscribers(bot, db, event)
    return event
