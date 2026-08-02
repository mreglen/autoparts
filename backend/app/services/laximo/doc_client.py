from __future__ import annotations

import logging
import time
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.models.site_laximo_cat_integration import DEFAULT_LAXIMO_CAT_BASE_URL
from app.services.laximo.gate import (
    doc_credentials_configured,
    get_plain_doc_credentials,
    increment_laximo_doc_request_counter,
    record_doc_upstream_error,
)
from app.utils.laximo_cat_integration_db import get_or_create_laximo_cat_integration
from app.utils.partnumber import normalize_partnumber

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT_SEC = 30.0
ACCEPT_LANGUAGE = "ru_RU"
FIND_OEM_CACHE_TTL_SEC = 3600
DEFAULT_MIN_RATE = 4
DOC_TEST_OEM = "0913128000"

_find_oem_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


class LaximoDocError(Exception):
    def __init__(self, message: str, *, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def clear_find_oem_cache() -> None:
    _find_oem_cache.clear()


def _resolve_doc_credentials(db: Session) -> tuple[str, str, str]:
    row = get_or_create_laximo_cat_integration(db)
    login, password = get_plain_doc_credentials(row)
    base_url = (getattr(row, "doc_base_url", None) or "").strip() or DEFAULT_LAXIMO_CAT_BASE_URL

    if not login or not password:
        raise LaximoDocError("Laximo.DOC credentials are not configured")

    return login, password, base_url.rstrip("/")


def request_doc(
    db: Session,
    path: str,
    *,
    params: Optional[dict[str, Any]] = None,
    count_toward_quota: bool = True,
    timeout_sec: float = DEFAULT_TIMEOUT_SEC,
) -> Any:
    """
    POST to Laximo.DOC REST endpoint.
    Does not log password. Product calls should pass count_toward_quota=True;
    admin test must pass False.
    """
    login, password, base_url = _resolve_doc_credentials(db)
    url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"

    try:
        with httpx.Client(timeout=timeout_sec) as client:
            response = client.post(
                url,
                params=params or None,
                auth=(login, password),
                headers={
                    "accept": "application/json",
                    "accept-language": ACCEPT_LANGUAGE,
                },
            )
    except httpx.TimeoutException as exc:
        if count_toward_quota:
            try:
                increment_laximo_doc_request_counter(db)
            except Exception:
                logger.exception("Failed to increment Laximo.DOC request counter")
        record_doc_upstream_error(db, "timeout")
        raise LaximoDocError("Laximo.DOC request timed out") from exc
    except httpx.HTTPError as exc:
        if count_toward_quota:
            try:
                increment_laximo_doc_request_counter(db)
            except Exception:
                logger.exception("Failed to increment Laximo.DOC request counter")
        record_doc_upstream_error(db, "network error")
        raise LaximoDocError("Laximo.DOC network error") from exc

    if count_toward_quota:
        try:
            increment_laximo_doc_request_counter(db)
        except Exception:
            logger.exception("Failed to increment Laximo.DOC request counter")

    if response.status_code >= 400:
        detail = f"HTTP {response.status_code}"
        record_doc_upstream_error(db, detail)
        raise LaximoDocError(detail, status_code=response.status_code)

    if not response.content:
        return []
    try:
        return response.json()
    except ValueError as exc:
        record_doc_upstream_error(db, "invalid JSON response")
        raise LaximoDocError("Laximo.DOC returned invalid JSON") from exc


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _normalize_replacements(payload: Any) -> list[dict[str, Any]]:
    """Flatten FindOEM response into replacement rows (brand, oem, name, rate)."""
    details = _as_list(payload)
    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    for detail in details:
        if not isinstance(detail, dict):
            continue
        replacements = detail.get("replacements") or detail.get("Replacements") or []
        for repl in _as_list(replacements):
            if not isinstance(repl, dict):
                continue
            nested = repl.get("detail") or repl.get("Detail") or {}
            if not isinstance(nested, dict):
                nested = {}
            brand = (
                nested.get("manufacturer")
                or nested.get("Manufacturer")
                or nested.get("brand")
                or ""
            )
            oem = nested.get("oem") or nested.get("OEM") or nested.get("formattedOem") or ""
            name = nested.get("name") or nested.get("Name") or None
            rate_raw = repl.get("rate") or repl.get("Rate")
            try:
                rate = int(rate_raw) if rate_raw is not None else None
            except (TypeError, ValueError):
                rate = None
            oem_text = str(oem).strip()
            if not oem_text:
                continue
            key = f"{str(brand).strip().upper()}|{normalize_partnumber(oem_text) or oem_text.upper()}"
            if key in seen:
                continue
            seen.add(key)
            out.append(
                {
                    "brand": str(brand).strip() or None,
                    "oem": oem_text,
                    "name": str(name).strip() if name else None,
                    "rate": rate,
                    "type": repl.get("type") or repl.get("Type"),
                    "way": repl.get("way") or repl.get("Way"),
                }
            )
    return out


def _cache_key(oem: str, brand: Optional[str], min_rate: int) -> str:
    norm = normalize_partnumber(oem) or oem.strip().upper()
    b = (brand or "").strip().upper()
    return f"{norm}|{b}|{min_rate}"


def find_oem(
    db: Session,
    oem: str,
    *,
    brand: Optional[str] = None,
    min_rate: int = DEFAULT_MIN_RATE,
    count_toward_quota: bool = True,
    use_cache: bool = True,
) -> list[dict[str, Any]]:
    """
    POST /findOem → list of replacement dicts {brand, oem, name, rate, ...}.
    Success-only process-local TTL cache (~1h) when use_cache=True.
    """
    oem_text = (oem or "").strip()
    if not oem_text:
        return []

    row = get_or_create_laximo_cat_integration(db)
    if not doc_credentials_configured(row):
        raise LaximoDocError("Laximo.DOC credentials are not configured")

    key = _cache_key(oem_text, brand, min_rate)
    if use_cache:
        entry = _find_oem_cache.get(key)
        if entry and time.monotonic() < entry[0]:
            return list(entry[1])
        if entry:
            _find_oem_cache.pop(key, None)

    params: dict[str, Any] = {
        "oem": oem_text,
        "showImages": "false",
        "replacementTypes": "Replacement",
        "minRate": min_rate,
    }
    if brand and str(brand).strip():
        params["brand"] = str(brand).strip()

    data = request_doc(
        db,
        "/findOem",
        params=params,
        count_toward_quota=count_toward_quota,
    )
    replacements = _normalize_replacements(data)

    if use_cache:
        _find_oem_cache[key] = (time.monotonic() + FIND_OEM_CACHE_TTL_SEC, list(replacements))

    return replacements
