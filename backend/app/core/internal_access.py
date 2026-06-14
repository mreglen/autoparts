from __future__ import annotations

from fastapi import HTTPException, Request, status

from app.core.config import settings


def require_internal_prerender(request: Request) -> None:
    """
    Доступ только из nginx internal locations с заголовком X-Internal-Prerender-Token.
    Если PRERENDER_INTERNAL_TOKEN не задан — проверка отключена (локальная разработка).
    """
    expected = (settings.PRERENDER_INTERNAL_TOKEN or "").strip()
    if not expected:
        return

    provided = (request.headers.get("X-Internal-Prerender-Token") or "").strip()
    if provided != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )
