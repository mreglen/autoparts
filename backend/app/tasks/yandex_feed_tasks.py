from __future__ import annotations

import time
from datetime import datetime, timezone

import requests

from app.celery_app import celery_app
from app.db.database import SessionLocal
from app.models.site_yandex_integration import SiteYandexIntegration
from app.services.yandex_feed_sync_service import (
    build_public_feed_url,
    normalize_feed_type,
    parse_region_ids_csv,
)
from app.services.yandex_feed_xml_service import generate_used_yml_feed
from app.services.yandex_webmaster_service import (
    YandexApiError,
    feeds_add_info,
    feeds_add_start,
    get_user,
    get_valid_access_token,
)
from app.utils.yandex_integration_db import (
    get_or_create_yandex_feed_sync_state,
    get_or_create_yandex_integration,
)


def _set_error(state, message: str) -> None:
    state.last_error = (message or "unknown error")[:4000]
    state.consecutive_failures = int(state.consecutive_failures or 0) + 1


@celery_app.task(bind=True, max_retries=1)
def run_yandex_feed_sync(self, trigger: str = "manual", force: bool = False):
    db = SessionLocal()
    try:
        integration = get_or_create_yandex_integration(db)
        state = get_or_create_yandex_feed_sync_state(db)

        if not integration.enabled:
            _set_error(state, "Интеграция Яндекс отключена")
            state.sync_in_progress = False
            db.commit()
            return {"ok": False, "reason": "integration disabled"}

        state.sync_in_progress = True
        state.last_sync_started_at = datetime.now(timezone.utc)
        state.last_error = None
        state.last_process_status = "IN_PROGRESS"
        if force:
            state.pending_sync = False
        db.commit()

        if not integration.host_id:
            _set_error(state, "host_id не настроен. Сначала выполните проверку сайта в Вебмастере.")
            state.sync_in_progress = False
            db.commit()
            return {"ok": False, "reason": "missing host_id"}

        feed_url = build_public_feed_url(integration.host_url)
        feed_type = normalize_feed_type(integration.feed_type)
        region_ids = parse_region_ids_csv(integration.region_ids_csv)

        feed_preview = generate_used_yml_feed(
            db,
            preferred_host_url=integration.host_url,
            condition_type=integration.used_condition_type,
            condition_reason=integration.used_condition_reason,
        )
        head = requests.get(feed_url, timeout=20)
        content_type = (head.headers.get("content-type") or "").lower()
        if head.status_code != 200:
            raise YandexApiError(f"Feed URL недоступен (HTTP {head.status_code})")
        if not any(t in content_type for t in ("application/xml", "text/xml", "application/octet-stream")):
            raise YandexApiError(
                f"Неверный Content-Type для feed URL: {head.headers.get('content-type') or 'unknown'}"
            )
        state.last_feed_url = feed_url
        state.last_checksum = feed_preview.checksum
        db.commit()

        access_token = get_valid_access_token(db, integration)
        user_payload = get_user(access_token)
        user_id = int(user_payload.get("user_id"))
        integration.yandex_user_id = user_id
        db.commit()

        start_payload = feeds_add_start(
            user_id,
            integration.host_id,
            access_token,
            feed_url=feed_url,
            feed_type=feed_type,
            region_ids=region_ids,
        )
        request_id = str(start_payload.get("requestId") or "").strip()
        if not request_id:
            raise YandexApiError("Яндекс не вернул requestId для асинхронной загрузки")

        state.last_request_id = request_id
        state.last_process_status = "IN_PROGRESS"
        db.commit()

        process_status = "IN_PROGRESS"
        for _ in range(36):  # до 3 минут
            info_payload = feeds_add_info(
                user_id=user_id,
                host_id=integration.host_id,
                token=access_token,
                request_id=request_id,
            )
            process_status = str(info_payload.get("processStatus") or "").strip().upper()
            state.last_process_status = process_status
            db.commit()
            if process_status == "OK":
                break
            if process_status and process_status != "IN_PROGRESS":
                break
            time.sleep(5)

        if process_status != "OK":
            _set_error(
                state,
                f"Асинхронная загрузка не завершена успешно. Статус: {process_status or 'UNKNOWN'}",
            )
            state.sync_in_progress = False
            state.last_sync_finished_at = datetime.now(timezone.utc)
            state.pending_sync = True if trigger != "manual" else False
            db.commit()
            return {"ok": False, "request_id": request_id, "status": process_status}

        state.last_error = None
        state.consecutive_failures = 0
        state.sync_in_progress = False
        state.pending_sync = False
        state.last_sync_finished_at = datetime.now(timezone.utc)
        state.last_process_status = "OK"
        db.commit()
        return {
            "ok": True,
            "request_id": request_id,
            "status": "OK",
            "offers_count": feed_preview.offers_count,
        }
    except YandexApiError as exc:
        state = get_or_create_yandex_feed_sync_state(db)
        _set_error(state, str(exc))
        state.sync_in_progress = False
        state.last_sync_finished_at = datetime.now(timezone.utc)
        state.pending_sync = True if trigger != "manual" else False
        db.commit()
        return {"ok": False, "reason": str(exc), "code": getattr(exc, "code", None)}
    except Exception as exc:  # noqa: BLE001
        state = get_or_create_yandex_feed_sync_state(db)
        _set_error(state, f"Внутренняя ошибка синхронизации: {exc}")
        state.sync_in_progress = False
        state.last_sync_finished_at = datetime.now(timezone.utc)
        state.pending_sync = True if trigger != "manual" else False
        db.commit()
        return {"ok": False, "reason": str(exc)}
    finally:
        db.close()
