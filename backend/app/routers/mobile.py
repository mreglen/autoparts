from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.schemas.mobile import LatestApkInfo, MobileMetaResponse
from app.utils.site_settings_db import get_or_create_site_settings

router = APIRouter(prefix="/mobile", tags=["Mobile"])

# Все datetime в ответах API — наивный wall-clock этой зоны (см. mobile/docs/stages/01-backend.md, раздел 3.1).
SERVER_TIMEZONE = "Europe/Moscow"


@router.get("/meta", response_model=MobileMetaResponse)
def get_mobile_meta(
    db: Session = Depends(get_db),
):
    now = datetime.now()
    offset = now.astimezone().utcoffset() or timedelta(0)
    row = get_or_create_site_settings(db)

    version = (getattr(row, "mobile_apk_version", None) or "").strip()
    url = (getattr(row, "mobile_apk_url", None) or "").strip()
    notes = (getattr(row, "mobile_apk_notes", None) or "").strip()
    latest_apk = None
    if version or url:
        latest_apk = LatestApkInfo(
            version=version or None,
            url=url or None,
            notes=notes or None,
        )

    return MobileMetaResponse(
        server_time=now.isoformat(timespec="seconds"),
        timezone=SERVER_TIMEZONE,
        utc_offset_minutes=int(offset.total_seconds() // 60),
        public_base_url=(settings.PUBLIC_BASE_URL or "").rstrip("/"),
        min_supported_app_version=(
            getattr(row, "mobile_min_app_version", None) or ""
        ).strip()
        or None,
        latest_apk=latest_apk,
    )
