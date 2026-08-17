from __future__ import annotations

import ipaddress
import json
import logging
import socket
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from sqlalchemy.orm import Session

from app.models.new_parts_seo_card import NewPartsSeoCard
from app.services.new_parts_seo_card_service import _payload_from_raw

logger = logging.getLogger(__name__)

OPENVERSE_IMAGES_URL = "https://api.openverse.org/v1/images/"
SEARCH_TIMEOUT_S = 12
DOWNLOAD_TIMEOUT_S = 15
MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024
RETRY_AFTER = timedelta(days=7)
CHECKED_AT_KEY = "openverse_image_checked_at"
ATTRIBUTION_KEY = "openverse_image_attribution"
USER_AGENT = "SvoyGarage/1.0 (https://svoygarage.ru; new-part card previews)"


class OpenverseImageSearchError(Exception):
    pass


def build_image_search_queries(brand: str, article: str, name: str | None = None) -> list[str]:
    brand = (brand or "").strip()
    article = (article or "").strip()
    name = (name or "").strip()
    queries: list[str] = []
    primary = " ".join(part for part in (brand, article) if part)
    if primary:
        queries.append(primary)
    fallback = " ".join(part for part in (brand, name) if part)
    if fallback and fallback.casefold() not in {q.casefold() for q in queries}:
        queries.append(fallback)
    return queries


def parse_image_results(payload: dict | list | None) -> list[dict]:
    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        rows = payload.get("results")
        if not isinstance(rows, list):
            rows = []
    else:
        rows = []

    parsed: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        url = _first_http_url(row.get("url"), row.get("thumbnail"))
        if not url or url in seen:
            continue
        seen.add(url)
        attribution = (row.get("attribution") or "").strip()
        if not attribution:
            creator = (row.get("creator") or "").strip()
            title = (row.get("title") or "").strip()
            license_name = (row.get("license") or "").strip()
            bits = [bit for bit in (title, creator, license_name.upper() if license_name else "") if bit]
            attribution = ". ".join(bits)
        parsed.append(
            {
                "url": url,
                "attribution": attribution or None,
                "license_url": (row.get("license_url") or "").strip() or None,
                "foreign_landing_url": (row.get("foreign_landing_url") or "").strip() or None,
            }
        )
    return parsed


def search_openverse_images(query: str) -> list[dict]:
    text = (query or "").strip()
    if not text:
        raise OpenverseImageSearchError("Пустой поисковый запрос")
    try:
        response = requests.get(
            OPENVERSE_IMAGES_URL,
            params={
                "q": text,
                "page_size": 5,
                "mature": "false",
                "license_type": "commercial",
            },
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
            timeout=SEARCH_TIMEOUT_S,
        )
    except requests.RequestException as exc:
        raise OpenverseImageSearchError(f"Не удалось обратиться к Openverse: {exc}") from exc

    if response.status_code >= 400:
        snippet = (response.text or "").strip().replace("\n", " ")[:180]
        raise OpenverseImageSearchError(snippet or f"Openverse HTTP {response.status_code}")

    try:
        payload = response.json()
    except ValueError as exc:
        raise OpenverseImageSearchError("Некорректный JSON ответа Openverse") from exc
    return parse_image_results(payload)


def first_openverse_image(brand: str, article: str, name: str | None = None) -> dict | None:
    for query in build_image_search_queries(brand, article, name):
        results = search_openverse_images(query)
        if results:
            return results[0]
    return None


def is_safe_download_url(url: str) -> bool:
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").strip().lower()
    if not host or host in {"localhost", "127.0.0.1", "::1"}:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    for info in infos:
        raw_ip = info[4][0]
        try:
            ip = ipaddress.ip_address(raw_ip)
        except ValueError:
            return False
        if not ip.is_global:
            return False
    return True


def download_image_bytes(url: str) -> tuple[bytes, str]:
    if not is_safe_download_url(url):
        raise OpenverseImageSearchError("Небезопасный URL изображения")
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "image/*,*/*;q=0.8"},
            timeout=DOWNLOAD_TIMEOUT_S,
            stream=True,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise OpenverseImageSearchError(f"Не удалось скачать изображение: {exc}") from exc

    content_type = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    chunks: list[bytes] = []
    total = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        if not chunk:
            continue
        total += len(chunk)
        if total > MAX_DOWNLOAD_BYTES:
            raise OpenverseImageSearchError("Изображение слишком большое")
        chunks.append(chunk)
    data = b"".join(chunks)
    if len(data) < 32:
        raise OpenverseImageSearchError("Пустой файл изображения")
    if content_type and not content_type.startswith("image/") and content_type not in {
        "application/octet-stream",
        "binary/octet-stream",
    }:
        raise OpenverseImageSearchError(f"Неожиданный тип файла: {content_type}")
    return data, content_type


def resolve_new_part_card_image(db: Session, card: NewPartsSeoCard) -> str | None:
    existing = (card.image_url or "").strip()
    if existing:
        return existing
    if _checked_recently(card):
        return None

    try:
        hit = first_openverse_image(card.brand or "", card.article or "", card.name)
        if not hit:
            _mark_image_checked(card)
            db.add(card)
            db.commit()
            db.refresh(card)
            return None
        data, content_type = download_image_bytes(hit["url"])
        relative = _store_preview(card.id, data, content_type, hit["url"])
        card.image_url = relative
        _mark_image_checked(card, attribution=hit.get("attribution"))
        db.add(card)
        db.commit()
        db.refresh(card)
        return relative
    except OpenverseImageSearchError as exc:
        logger.info("Openverse image resolve skipped for card %s: %s", card.id, exc)
        _mark_image_checked(card)
        db.add(card)
        db.commit()
        return None


def _first_http_url(*values: object) -> str | None:
    for value in values:
        text = str(value or "").strip()
        if text.startswith(("http://", "https://")):
            return text
    return None


def _checked_recently(card: NewPartsSeoCard) -> bool:
    payload = _payload_from_raw(card)
    raw = payload.get(CHECKED_AT_KEY)
    if not raw:
        return False
    try:
        checked_at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return False
    if checked_at.tzinfo is None:
        checked_at = checked_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - checked_at < RETRY_AFTER


def _mark_image_checked(card: NewPartsSeoCard, attribution: str | None = None) -> None:
    payload = _payload_from_raw(card)
    payload[CHECKED_AT_KEY] = datetime.now(timezone.utc).isoformat()
    if attribution:
        payload[ATTRIBUTION_KEY] = attribution[:500]
    card.raw_payload = json.dumps(payload, ensure_ascii=False)


def _uploads_root() -> Path:
    return Path(__file__).resolve().parents[2] / "uploads"


def _extension_for(content_type: str, source_url: str) -> str:
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    if content_type in mapping:
        return mapping[content_type]
    path = urlparse(source_url).path.lower()
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return ".jpg"


def _store_preview(card_id: int, data: bytes, content_type: str, source_url: str) -> str:
    ext = _extension_for(content_type, source_url)
    directory = _uploads_root() / "new-parts" / str(int(card_id))
    directory.mkdir(parents=True, exist_ok=True)
    filename = f"preview{ext}"
    (directory / filename).write_bytes(data)
    return f"/uploads/new-parts/{int(card_id)}/{filename}"
