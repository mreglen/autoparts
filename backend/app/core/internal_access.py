from __future__ import annotations

from fastapi import HTTPException, Request, status

from app.core.config import settings


def require_internal_prerender(request: Request) -> None:
    """
    Доступ только из nginx internal locations с заголовком X-Internal-Prerender-Token.
    Без токена доступ разрешён только в локальной разработке.
    """
    expected = (settings.PRERENDER_INTERNAL_TOKEN or "").strip()
    if not expected:
        if settings.APP_ENV.lower() in {"development", "dev", "test"}:
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal prerender is not configured",
        )

    provided = (request.headers.get("X-Internal-Prerender-Token") or "").strip()
    if provided != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden",
        )
