from __future__ import annotations

import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import httpx
from celery.result import AsyncResult
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.organization import Organization as OrganizationModel
from app.models.user import User as UserModel
from app.tasks.photo_tasks import process_and_upload_photo


LOCAL_PREFIXES = ("/pictures/", "/uploads/", "/temp/")
_TEMP_URL_RE = re.compile(r"^/temp/[^/]+/.+")


@dataclass(frozen=True)
class WatermarkSettings:
    add_watermark: bool
    logo_file_path: str | None


def _base_url() -> str:
    return (settings.PUBLIC_BASE_URL or settings.BASE_URL or "").strip().rstrip("/")


def _strip_base_url(url: str) -> str:
    """If url is absolute and points to our base URL, return its path; else return original."""
    u = (url or "").strip()
    if not u:
        return ""
    if not (u.startswith("http://") or u.startswith("https://")):
        return u
    bu = _base_url()
    if not bu:
        return u
    try:
        pu = urlparse(u)
        pb = urlparse(bu)
        if pu.scheme == pb.scheme and pu.netloc == pb.netloc:
            return pu.path or "/"
    except Exception:
        return u
    return u


def is_local_media(url: str) -> bool:
    value = _strip_base_url(url)
    return any(value.startswith(p) for p in LOCAL_PREFIXES)


def normalize_for_xlsx(url_or_path: str) -> str:
    """Return absolute URL for XLSX if we have BASE_URL; otherwise keep as-is."""
    value = (url_or_path or "").strip()
    if not value:
        return ""
    pathish = _strip_base_url(value)
    if any(pathish.startswith(p) for p in LOCAL_PREFIXES):
        bu = _base_url()
        return f"{bu}{pathish}" if bu else pathish
    return value


def get_watermark_settings(db: Session, org_id: str) -> WatermarkSettings:
    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org or org.watermark is None or int(org.watermark) == 0:
        return WatermarkSettings(add_watermark=False, logo_file_path=None)

    add_watermark = False
    logo_file_path: str | None = None

    if int(org.watermark) == 1:
        admin_user = db.query(UserModel).filter(UserModel.is_admin == True).first()  # noqa: E712
        if admin_user and admin_user.organization_id:
            admin_org = (
                db.query(OrganizationModel).filter(OrganizationModel.id == admin_user.organization_id).first()
            )
            if admin_org and admin_org.logo_organization:
                add_watermark = True
                logo_path_value = str(admin_org.logo_organization).lstrip("/").lstrip("\\")
                if not logo_path_value.lower().startswith("uploads"):
                    logo_file_path = os.path.join("uploads", logo_path_value)
                else:
                    logo_file_path = logo_path_value

    if int(org.watermark) == 2:
        if org.logo_organization:
            add_watermark = True
            logo_path_value = str(org.logo_organization).lstrip("/").lstrip("\\")
            if not logo_path_value.lower().startswith("uploads"):
                logo_file_path = os.path.join("uploads", logo_path_value)
            else:
                logo_file_path = logo_path_value

    if logo_file_path and not os.path.exists(logo_file_path):
        # watermark requested but logo missing — treat as no watermark
        return WatermarkSettings(add_watermark=False, logo_file_path=None)

    return WatermarkSettings(add_watermark=add_watermark, logo_file_path=logo_file_path)


async def download_to_temp(
    url: str,
    org_id: str,
    *,
    timeout_s: float = 25.0,
    max_bytes: int = 30 * 1024 * 1024,
) -> tuple[str, str]:
    """
    Download external url to uploads/temp/{org_id}/{uuid}.{ext}
    Returns (temp_rel_url, temp_abs_path)
    """
    u = (url or "").strip()
    if not u:
        raise ValueError("empty url")
    if not (u.startswith("http://") or u.startswith("https://")):
        raise ValueError("only http(s) is supported")

    parsed = urlparse(u)
    ext = Path(parsed.path).suffix.lower()
    if not ext:
        ext = ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"

    temp_dir = Path("uploads") / "temp" / str(org_id)
    temp_dir.mkdir(parents=True, exist_ok=True)
    abs_path = (temp_dir / filename).resolve()

    total = 0
    async with httpx.AsyncClient(timeout=timeout_s, follow_redirects=True) as client:
        async with client.stream("GET", u) as r:
            r.raise_for_status()
            with open(abs_path, "wb") as f:
                async for chunk in r.aiter_bytes():
                    if not chunk:
                        continue
                    total += len(chunk)
                    if total > max_bytes:
                        raise ValueError(f"file too large (> {max_bytes} bytes)")
                    f.write(chunk)

    temp_rel = f"/temp/{org_id}/{filename}"
    return temp_rel, str(abs_path)


def process_temp_to_pictures_sync(
    temp_abs_path: str,
    *,
    org_id: str,
    watermark: WatermarkSettings,
    celery_timeout_s: int = 120,
) -> str:
    """
    Run existing Celery photo pipeline and wait synchronously.
    Returns final relative path like /pictures/{org_id}/xxx.webp
    """
    original_filename = os.path.basename(temp_abs_path)
    async_result = process_and_upload_photo.delay(
        temp_abs_path,
        original_filename,
        org_id,
        "pictures",
        bool(watermark.add_watermark),
        watermark.logo_file_path,
        None,
        None,
        None,
    )
    res = AsyncResult(async_result.id, app=process_and_upload_photo.app).get(timeout=celery_timeout_s)
    if isinstance(res, dict) and res.get("path"):
        return str(res["path"])
    raise RuntimeError(f"Unexpected celery result: {res!r}")


async def ensure_local_pictures(
    urls: Iterable[str],
    *,
    org_id: str,
    db: Session,
    for_xlsx: bool,
    per_photo_timeout_s: float = 25.0,
    per_photo_max_bytes: int = 30 * 1024 * 1024,
    celery_timeout_s: int = 120,
    limit: int = 5,
    soft_fail: bool = True,
) -> list[str]:
    """
    Returns list of urls/paths:
    - if for_xlsx=True -> absolute URL (BASE_URL + /pictures/...)
    - else -> relative path (/pictures/...)
    """
    wm = get_watermark_settings(db, org_id)
    out: list[str] = []
    seen: set[str] = set()

    def _push(v: str) -> None:
        vv = (v or "").strip()
        if not vv or vv in seen:
            return
        seen.add(vv)
        out.append(vv)

    for raw in list(urls or [])[:limit]:
        value = (raw or "").strip()
        if not value:
            continue

        # Treat absolute URLs pointing to our own base as local paths.
        stripped = _strip_base_url(value)
        if any(stripped.startswith(p) for p in LOCAL_PREFIXES):
            final = normalize_for_xlsx(stripped) if for_xlsx else stripped
            _push(final)
            continue

        # External: download -> temp -> celery -> /pictures
        try:
            temp_rel, temp_abs = await download_to_temp(
                value, org_id, timeout_s=per_photo_timeout_s, max_bytes=per_photo_max_bytes
            )
            # If download returns /temp/... we can process from abs path
            final_rel = process_temp_to_pictures_sync(
                temp_abs, org_id=org_id, watermark=wm, celery_timeout_s=celery_timeout_s
            )
            final = normalize_for_xlsx(final_rel) if for_xlsx else final_rel
            _push(final)
        except Exception:
            if soft_fail:
                # Keep original link if processing failed
                _push(value)
            else:
                raise

    return out

