import asyncio
import logging
import re
from pathlib import Path

from telegram import Bot

from alert_bot.config import Settings
from alert_bot.db.session import SessionLocal
from alert_bot.services.alerts import make_dedupe_key, record_and_notify

logger = logging.getLogger(__name__)

JOURNAL_UNITS = ("kroan", "celery", "pgbouncer", "postgresql", "nginx")
NGINX_ERROR_LOG = Path("/var/log/nginx/svoygarage_ssl_error.log")

# Skip noisy journald / nginx boilerplate
_SKIP_PATTERNS = re.compile(
    r"(client closed|upstream prematurely|Connection reset|SSL_do_handshake|"
    r"recv\(\) failed|connect\(\) failed \(111\)|no live upstreams)",
    re.IGNORECASE,
)


async def _read_stream(stream: asyncio.StreamReader, source: str, bot: Bot, settings: Settings) -> None:
    while True:
        line = await stream.readline()
        if not line:
            break
        text = line.decode("utf-8", errors="ignore").strip()
        if not text or _SKIP_PATTERNS.search(text):
            continue
        title = text[:200] if len(text) > 200 else text
        dedupe_key = make_dedupe_key(source, title, text)
        db = SessionLocal()
        try:
            severity = "error" if source in ("kroan", "celery") else "warning"
            await record_and_notify(
                bot,
                db,
                settings,
                source=source,
                severity=severity,
                title=title[:255],
                message=text,
                dedupe_key=dedupe_key,
            )
        except Exception as exc:
            logger.exception("log_collector error for %s: %s", source, exc)
        finally:
            db.close()


async def _watch_journal(unit: str, bot: Bot, settings: Settings) -> None:
    cmd = ["journalctl", "-u", unit, "-f", "-n", "0", "-p", "err..alert", "--no-pager"]
    while True:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            if proc.stdout is None:
                await asyncio.sleep(10)
                continue
            logger.info("Watching journalctl -u %s", unit)
            await _read_stream(proc.stdout, unit, bot, settings)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("journalctl %s failed: %s, retry in 15s", unit, exc)
            await asyncio.sleep(15)


async def _watch_file(path: Path, source: str, bot: Bot, settings: Settings) -> None:
    if not path.exists():
        logger.warning("Log file not found: %s", path)
        return
    cmd = ["tail", "-F", "-n", "0", str(path)]
    while True:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            if proc.stdout is None:
                await asyncio.sleep(10)
                continue
            logger.info("Watching %s", path)
            await _read_stream(proc.stdout, source, bot, settings)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("tail %s failed: %s, retry in 15s", path, exc)
            await asyncio.sleep(15)


async def run_log_collector(bot: Bot, settings: Settings) -> None:
    tasks = []
    for unit in JOURNAL_UNITS:
        tasks.append(asyncio.create_task(_watch_journal(unit, bot, settings)))
    tasks.append(asyncio.create_task(_watch_file(NGINX_ERROR_LOG, "nginx", bot, settings)))
    await asyncio.gather(*tasks)
