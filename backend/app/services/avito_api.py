import logging
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

AVITO_BASE = "https://api.avito.ru"


async def fetch_access_token(client_id: str, client_secret: str) -> str:
    """OAuth2 client_credentials. Сначала POST form, затем GET /token/ как в публичном Swagger Авито."""
    last: Optional[httpx.Response] = None
    async with httpx.AsyncClient(timeout=45.0) as client:
        r_post = await client.post(
            f"{AVITO_BASE}/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        last = r_post
        if r_post.status_code == 200:
            data = r_post.json()
            token = data.get("access_token")
            if token:
                return token
            raise RuntimeError(f"Ответ /token без access_token: {data}")

        r_get = await client.get(
            f"{AVITO_BASE}/token/",
            params={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
        )
        last = r_get
        if r_get.status_code == 200:
            data = r_get.json()
            token = data.get("access_token")
            if token:
                return token
            raise RuntimeError(f"Ответ /token/ без access_token: {data}")

    body = (last.text[:800] if last else "") or ""
    logger.warning("Avito OAuth не удался: %s %s", last.status_code if last else "?", body)
    raise RuntimeError(f"Не удалось получить токен Авито (HTTP {last.status_code if last else '?'}): {body}")


async def upload_autoload_xlsx(access_token: str, filename: str, file_bytes: bytes) -> tuple[int, dict[str, Any]]:
    """
    Загрузка файла автозагрузки. Эндпоинт: POST /autoload/v1/upload
    Пробуем несколько имён поля multipart — спецификация в публичных источниках не всегда совпадает.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    last_status = 0
    last_body: Any = None

    async with httpx.AsyncClient(timeout=120.0) as client:
        for field in ("file", "upload", "content"):
            files = {field: (filename, file_bytes, content_type)}
            r = await client.post(f"{AVITO_BASE}/autoload/v1/upload", headers=headers, files=files)
            last_status = r.status_code
            try:
                last_body = r.json()
            except Exception:
                last_body = {"raw": r.text[:8000]}

            if r.status_code in (200, 201):
                return r.status_code, last_body if isinstance(last_body, dict) else {"result": last_body}

            if r.status_code == 404:
                continue

            return r.status_code, last_body if isinstance(last_body, dict) else {"error": str(last_body)}

    return last_status, last_body if isinstance(last_body, dict) else {"error": str(last_body)}


async def get_last_completed_report_v3(access_token: str) -> Optional[dict[str, Any]]:
    """Опционально: последний завершённый отчёт (новее, чем v1 last_report)."""
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/autoload/v3/reports/last_completed_report",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except Exception:
            return None


async def get_last_report_v1(access_token: str, user_id: int) -> Optional[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(
            f"{AVITO_BASE}/autoload/v1/accounts/{user_id}/reports/last_report/",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except Exception:
            return None
