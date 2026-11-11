from __future__ import annotations

import re
from typing import Any, Optional

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status

from app.celery_app import celery_app
from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.tasks import TaskStatusResponse
from app.utils.task_ownership import task_owner_user_id

router = APIRouter(prefix="/tasks", tags=["Tasks"])

TASK_ID_PATTERN = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
ERROR_MAX_CHARS = 300


def _human_error(info: Any) -> str:
    message = str(info or "").strip()
    first_line = message.splitlines()[0].strip() if message else ""
    return first_line[:ERROR_MAX_CHARS] or "Задача завершилась с ошибкой"


def _progress(info: Any) -> Optional[int]:
    if not isinstance(info, dict):
        return None
    value = info.get("progress")
    return int(value) if isinstance(value, (int, float)) else None


@router.get("/{task_id}", response_model=TaskStatusResponse)
def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
) -> TaskStatusResponse:
    """Состояние фоновой задачи для опроса. Видна только тому, кто её поставил."""
    if not TASK_ID_PATTERN.fullmatch(task_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена или её результат уже утрачен — проверьте список",
        )

    owner_id = task_owner_user_id(task_id)
    if owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена или её результат уже утрачен — проверьте список",
        )
    if owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Нет доступа к этой задаче",
        )

    async_result = AsyncResult(task_id, app=celery_app)
    state = async_result.state
    if state == "SUCCESS":
        return TaskStatusResponse(state=state, result=async_result.result)
    if state in ("FAILURE", "REVOKED"):
        return TaskStatusResponse(state=state, error=_human_error(async_result.info))
    return TaskStatusResponse(state=state, progress=_progress(async_result.info))
