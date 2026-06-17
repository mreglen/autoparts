from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_admin_user
from app.core.config import settings
from app.db.database import get_db
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.backup_service import (
    cleanup_old_backups,
    create_database_backup,
    create_uploads_backup,
    list_backups,
    resolve_backup_path,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/backups", tags=["Admin backups"])


def _media_type_for_filename(filename: str) -> str:
    if filename.endswith(".sql.gz"):
        return "application/gzip"
    if filename.endswith(".tar.gz"):
        return "application/gzip"
    return "application/octet-stream"


@router.get("")
def get_backups(
    current_user: User = Depends(get_current_admin_user),
):
    del current_user
    return {
        "items": [item.to_dict() for item in list_backups()],
        "retention_count": int(settings.BACKUP_RETENTION_COUNT or 8),
        "weekly_hour_utc": int(settings.BACKUP_WEEKLY_HOUR_UTC or 4),
    }


@router.post("/database")
def create_database_backup_now(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        item = create_database_backup(trigger="manual")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Manual database backup failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания резервной копии БД: {exc}",
        ) from exc

    cleanup_old_backups()
    log_audit(
        db,
        event_type="backup_database_created",
        category="settings",
        summary=f"Создана резервная копия БД: {item.filename}",
        user=current_user,
        entity_type="backup",
        entity_id=item.id,
        details={"size_bytes": item.size_bytes},
    )
    return item.to_dict()


@router.post("/uploads")
def create_uploads_backup_now(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        item = create_uploads_backup(trigger="manual")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Manual uploads backup failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания резервной копии uploads: {exc}",
        ) from exc

    cleanup_old_backups()
    log_audit(
        db,
        event_type="backup_uploads_created",
        category="settings",
        summary=f"Создана резервная копия uploads: {item.filename}",
        user=current_user,
        entity_type="backup",
        entity_id=item.id,
        details={"size_bytes": item.size_bytes},
    )
    return item.to_dict()


@router.post("/database/download")
def create_and_download_database_backup(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        item = create_database_backup(trigger="manual")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Database backup download failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания резервной копии БД: {exc}",
        ) from exc

    cleanup_old_backups()
    log_audit(
        db,
        event_type="backup_database_downloaded",
        category="settings",
        summary=f"Скачана резервная копия БД: {item.filename}",
        user=current_user,
        entity_type="backup",
        entity_id=item.id,
        details={"size_bytes": item.size_bytes},
    )
    path = resolve_backup_path(item.id)
    return FileResponse(
        path=path,
        filename=item.filename,
        media_type=_media_type_for_filename(item.filename),
    )


@router.post("/uploads/download")
def create_and_download_uploads_backup(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        item = create_uploads_backup(trigger="manual")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Uploads backup download failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка создания резервной копии uploads: {exc}",
        ) from exc

    cleanup_old_backups()
    log_audit(
        db,
        event_type="backup_uploads_downloaded",
        category="settings",
        summary=f"Скачана резервная копия uploads: {item.filename}",
        user=current_user,
        entity_type="backup",
        entity_id=item.id,
        details={"size_bytes": item.size_bytes},
    )
    path = resolve_backup_path(item.id)
    return FileResponse(
        path=path,
        filename=item.filename,
        media_type=_media_type_for_filename(item.filename),
    )


@router.get("/{backup_id}/download")
def download_existing_backup(
    backup_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        path = resolve_backup_path(backup_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    log_audit(
        db,
        event_type="backup_downloaded",
        category="settings",
        summary=f"Скачана резервная копия: {backup_id}",
        user=current_user,
        entity_type="backup",
        entity_id=backup_id,
    )
    return FileResponse(
        path=path,
        filename=backup_id,
        media_type=_media_type_for_filename(backup_id),
    )


@router.delete("/{backup_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup(
    backup_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    try:
        path = resolve_backup_path(backup_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    path.unlink(missing_ok=True)
    log_audit(
        db,
        event_type="backup_deleted",
        category="settings",
        summary=f"Удалена резервная копия: {backup_id}",
        user=current_user,
        entity_type="backup",
        entity_id=backup_id,
    )
