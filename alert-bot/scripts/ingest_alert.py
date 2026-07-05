#!/usr/bin/env python3
"""CLI for health-monitor.sh to ingest alerts into DB and notify subscribers."""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from telegram import Bot

from alert_bot.config import get_settings
from alert_bot.db.models import Base
from alert_bot.db.session import SessionLocal, engine
from alert_bot.services.alerts import make_dedupe_key, notify_subscribers, record_alert

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


async def _run(args: argparse.Namespace) -> int:
    settings = get_settings()
    init_db()
    dedupe_key = args.key or make_dedupe_key(args.source, args.title, args.message)
    db = SessionLocal()
    try:
        event, notify = record_alert(
            db,
            source=args.source,
            severity=args.severity,
            title=args.title,
            message=args.message,
            dedupe_key=dedupe_key,
            settings=settings,
        )
        if event and notify:
            bot = Bot(settings.bot_token)
            sent = await notify_subscribers(bot, db, event)
            logger.info("Alert recorded id=%s, notified %s subscribers", event.id, sent)
        elif event:
            logger.info("Alert recorded id=%s (cooldown skip notify)", event.id)
        else:
            logger.info("Alert skipped (cooldown)")
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest server alert")
    parser.add_argument("--source", required=True)
    parser.add_argument("--key", default="")
    parser.add_argument("--severity", default="warning")
    parser.add_argument("--title", required=True)
    parser.add_argument("--message", required=True)
    args = parser.parse_args()
    try:
        return asyncio.run(_run(args))
    except Exception as exc:
        logger.error("ingest failed: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
