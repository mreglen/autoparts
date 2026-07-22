"""StaticFiles that emit long-lived Cache-Control for uniquely named media."""

from __future__ import annotations

from starlette.staticfiles import StaticFiles
from starlette.types import Scope

CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable"


class CachedStaticFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope: Scope, status_code: int = 200):
        response = super().file_response(full_path, stat_result, scope, status_code=status_code)
        response.headers.setdefault("Cache-Control", CACHE_CONTROL_IMMUTABLE)
        return response
