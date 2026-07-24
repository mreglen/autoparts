"""
Drom baza price-list API client.

Docs: https://baza.drom.ru/help/API
POST https://baza.drom.ru/good/packet/api/sync
multipart: packetId, auth=sha512(cabinet_key), data (XLS/CSV/XML ≤ 5 MB)
"""
from __future__ import annotations

import hashlib
import logging
import re
import asyncio
from dataclasses import dataclass
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

DROM_SYNC_URL = "https://baza.drom.ru/good/packet/api/sync"
DROM_MAX_DATA_BYTES = 5 * 1024 * 1024

ERROR_AUTH_FAILED = "ERROR_REASON_AUTH_FAILED"
ERROR_PACKET_NOT_FOUND = "ERROR_REASON_PACKET_NOT_FOUND"
ERROR_EMPTY_REQUEST = "ERROR_REASON_EMPTY_REQUEST"

KNOWN_ERROR_CODES = (
    ERROR_AUTH_FAILED,
    ERROR_PACKET_NOT_FOUND,
    ERROR_EMPTY_REQUEST,
)

_ERROR_HINTS = {
    ERROR_AUTH_FAILED: "Неверный ключ кабинета (auth). Проверьте ключ и расчёт sha512.",
    ERROR_PACKET_NOT_FOUND: "Прайс-лист не найден или не подключен к API. Проверьте packetId и настройки у менеджера Drom.",
    ERROR_EMPTY_REQUEST: "В запросе отсутствуют обязательные параметры data или auth.",
}


@dataclass
class DromSyncResult:
    ok: bool
    status_code: int
    body_text: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    chunks_sent: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "status_code": self.status_code,
            "body_text": self.body_text[:2000] if self.body_text else "",
            "error_code": self.error_code,
            "error_message": self.error_message,
            "chunks_sent": self.chunks_sent,
        }


def compute_auth(api_key: str) -> str:
    """auth = sha512 hex digest of the cabinet key string."""
    return hashlib.sha512((api_key or "").encode("utf-8")).hexdigest()


def parse_drom_error(body_text: str, status_code: int) -> tuple[Optional[str], str]:
    text = (body_text or "").strip()
    upper = text.upper()
    for code in KNOWN_ERROR_CODES:
        if code in upper or code in text:
            return code, _ERROR_HINTS.get(code, text or code)

    # Sometimes code is embedded without full prefix
    match = re.search(r"ERROR_REASON_[A-Z_]+", text)
    if match:
        code = match.group(0)
        return code, _ERROR_HINTS.get(code, text)

    if status_code == 200:
        return None, ""
    if not text:
        return None, f"HTTP {status_code}"
    return None, text[:500]


async def sync_price_list_chunk(
    *,
    packet_id: str,
    api_key: str,
    file_bytes: bytes,
    filename: str = "drom-sync.xlsx",
    timeout_sec: float = 120.0,
) -> DromSyncResult:
    return await asyncio.to_thread(
        sync_price_list_chunk_sync,
        packet_id=packet_id,
        api_key=api_key,
        file_bytes=file_bytes,
        filename=filename,
        timeout_sec=timeout_sec,
    )


def sync_price_list_chunk_sync(
    *,
    packet_id: str,
    api_key: str,
    file_bytes: bytes,
    filename: str = "drom-sync.xlsx",
    timeout_sec: float = 120.0,
) -> DromSyncResult:
    if not packet_id:
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_code=ERROR_PACKET_NOT_FOUND,
            error_message="Не указан packetId прайс-листа",
            chunks_sent=0,
        )
    if not api_key:
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_code=ERROR_AUTH_FAILED,
            error_message="Не указан ключ кабинета Drom",
            chunks_sent=0,
        )
    if not file_bytes:
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_code=ERROR_EMPTY_REQUEST,
            error_message="Пустой файл data",
            chunks_sent=0,
        )
    if len(file_bytes) > DROM_MAX_DATA_BYTES:
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_code=ERROR_EMPTY_REQUEST,
            error_message=f"Файл больше лимита Drom ({DROM_MAX_DATA_BYTES} байт)",
            chunks_sent=0,
        )

    auth = compute_auth(api_key)
    files = {
        "data": (
            filename,
            file_bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    }
    data = {
        "packetId": str(packet_id).strip(),
        "auth": auth,
    }

    try:
        with httpx.Client(timeout=timeout_sec) as client:
            response = client.post(DROM_SYNC_URL, data=data, files=files)
    except httpx.HTTPError as exc:
        logger.exception("Drom sync request failed")
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_message=f"Сетевая ошибка Drom API: {exc}",
            chunks_sent=0,
        )

    body_text = response.text or ""
    error_code, error_message = parse_drom_error(body_text, response.status_code)
    ok = response.status_code == 200 and error_code is None
    if ok:
        error_message = None
    elif not error_message:
        error_message = f"HTTP {response.status_code}"

    return DromSyncResult(
        ok=ok,
        status_code=response.status_code,
        body_text=body_text,
        error_code=error_code,
        error_message=error_message,
        chunks_sent=1,
    )


async def sync_price_list_chunks(
    *,
    packet_id: str,
    api_key: str,
    chunks: list[bytes],
    filename_prefix: str = "drom-sync",
) -> DromSyncResult:
    if not chunks:
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_code=ERROR_EMPTY_REQUEST,
            error_message="Нет данных для отправки",
            chunks_sent=0,
        )

    last = DromSyncResult(ok=False, status_code=0, body_text="", chunks_sent=0)
    for index, chunk in enumerate(chunks, start=1):
        last = await sync_price_list_chunk(
            packet_id=packet_id,
            api_key=api_key,
            file_bytes=chunk,
            filename=f"{filename_prefix}-{index}.xlsx",
        )
        last.chunks_sent = index
        if not last.ok:
            return last
    return last


def sync_price_list_chunks_sync(
    *,
    packet_id: str,
    api_key: str,
    chunks: list[bytes],
    filename_prefix: str = "drom-sync",
) -> DromSyncResult:
    if not chunks:
        return DromSyncResult(
            ok=False,
            status_code=0,
            body_text="",
            error_code=ERROR_EMPTY_REQUEST,
            error_message="Нет данных для отправки",
            chunks_sent=0,
        )
    last = DromSyncResult(ok=False, status_code=0, body_text="", chunks_sent=0)
    for index, chunk in enumerate(chunks, start=1):
        last = sync_price_list_chunk_sync(
            packet_id=packet_id,
            api_key=api_key,
            file_bytes=chunk,
            filename=f"{filename_prefix}-{index}.xlsx",
        )
        last.chunks_sent = index
        if not last.ok:
            return last
    return last
