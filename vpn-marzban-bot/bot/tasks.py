"""
Фоновые задачи Celery: проверка подлинности ключей и синхронизация с Marzban.

Проверяет для каждого пользователя в marzvpn_users:
1. Существует ли аккаунт в Marzban
2. Есть ли VLESS links в Marzban
3. crypt4_link — soft crypt4 с {"configs":[vless://...]}
4. Если expire_at < now → отключает профиль в Marzban (ключ тот же)
5. Если expire_at >= now → активирует и синхронизирует expire в Marzban
6. Пересобирает crypt4 из актуальных VLESS links
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx

from celery_app import celery_app
from config import get_settings
from db import (
    create_tables,
    init_db,
    list_all_users,
    mark_user_verified,
    session_factory,
)
from happ_crypto import build_happ_crypt4, is_real_happ_crypto_link
from marzban_api import MarzbanClient

logger = logging.getLogger("marzban-vpn-bot.tasks")


async def _verify_all_keys() -> dict:
    settings = get_settings()
    init_db(settings)
    await create_tables()

    marzban = MarzbanClient(settings)
    stats = {
        "checked": 0,
        "valid": 0,
        "invalid": 0,
        "disabled": 0,
        "reactivated": 0,
        "missing_in_marzban": 0,
        "reencrypted": 0,
        "errors": 0,
    }

    try:
        async with session_factory()() as session:
            users = list(await list_all_users(session))
            now = datetime.now(timezone.utc)

            for user in users:
                stats["checked"] += 1
                notes: list[str] = []
                key_valid = True

                try:
                    remote = await marzban.get_user(user.marzban_username)
                    if remote is None:
                        key_valid = False
                        stats["missing_in_marzban"] += 1
                        notes.append("missing_in_marzban")
                        await mark_user_verified(
                            session,
                            user.telegram_id,
                            key_valid=False,
                            note="; ".join(notes),
                        )
                        continue

                    vless_links = marzban.extract_vless_links(remote)
                    if not vless_links:
                        key_valid = False
                        notes.append("no_vless_links")

                    # HTTPS sub — опциональный контроль (ключ больше не зависит от URL)
                    try:
                        async with httpx.AsyncClient(
                            timeout=15.0, follow_redirects=True
                        ) as client:
                            sub_resp = await client.get(user.subscription_url)
                        if sub_resp.status_code != 200 or len(sub_resp.content) < 16:
                            notes.append(f"sub_http_{sub_resp.status_code}")
                    except Exception as exc:
                        notes.append(f"sub_fetch_error:{exc}")

                    need_reencrypt = not is_real_happ_crypto_link(user.crypt4_link)
                    if not need_reencrypt and vless_links:
                        need_reencrypt = user.crypt4_link != build_happ_crypt4(
                            vless_links
                        )
                    if need_reencrypt and vless_links:
                        user.crypt4_link = build_happ_crypt4(vless_links)
                        user.verify_note = "crypt4_normalized_urlsafe"
                        stats["reencrypted"] += 1
                        notes.append("reencrypted_configs")

                    expire_at = user.expire_at
                    if expire_at.tzinfo is None:
                        expire_at = expire_at.replace(tzinfo=timezone.utc)

                    remote_status = str(remote.get("status") or "")
                    remote_expire = int(remote.get("expire") or 0)

                    if expire_at <= now:
                        if remote_status != "disabled":
                            await marzban.disable_user(user.marzban_username)
                            stats["disabled"] += 1
                            notes.append("disabled_expired")
                    else:
                        need_activate = remote_status != "active"
                        need_expire_sync = abs(
                            remote_expire - int(expire_at.timestamp())
                        ) > 60
                        if need_activate or need_expire_sync:
                            await marzban.activate_user(
                                user.marzban_username,
                                expire_at=expire_at,
                            )
                            if need_activate:
                                stats["reactivated"] += 1
                            notes.append("synced_active_expire")

                    if key_valid:
                        stats["valid"] += 1
                    else:
                        stats["invalid"] += 1

                    await mark_user_verified(
                        session,
                        user.telegram_id,
                        key_valid=key_valid,
                        note="; ".join(notes) if notes else "ok",
                    )
                except Exception as exc:
                    stats["errors"] += 1
                    logger.exception(
                        "Ошибка проверки tg=%s marzban=%s: %s",
                        user.telegram_id,
                        user.marzban_username,
                        exc,
                    )
                    await mark_user_verified(
                        session,
                        user.telegram_id,
                        key_valid=False,
                        note=f"error:{exc}",
                    )

            await session.commit()
    finally:
        await marzban.aclose()

    logger.info("verify_keys_authenticity done: %s", stats)
    return stats


@celery_app.task(name="marzvpn.verify_keys_authenticity")
def verify_keys_authenticity() -> dict:
    """Периодическая проверка подлинности ключей и синхронизация expire/status."""
    return asyncio.run(_verify_all_keys())
