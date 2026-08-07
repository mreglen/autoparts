from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.services.laximo.cat_client import (
    LaximoCatError,
    find_vehicle,
    find_vehicle_by_plate_number,
    identify_by_plate_number_full,
)
from app.services.laximo.frame import normalize_frame_or_raise
from app.services.laximo.gate import (
    PUBLIC_NOT_FOUND,
    PUBLIC_OK,
    PUBLIC_TEMPORARILY_UNAVAILABLE,
    laximo_cat_ready,
    public_message_for_reason,
)
from app.services.laximo.plate import normalize_plate_or_raise
from app.services.laximo.vehicle_normalize import (
    NormalizedVehicleCandidate,
    enrich_candidate_from_plate_full,
    normalize_find_vehicle_row,
    normalize_plate_full_card,
)
from app.services.laximo.vin import looks_like_vin, normalize_vin_or_none, normalize_vin_or_raise

logger = logging.getLogger(__name__)

CACHE_TTL_SEC = 3600

# Process-local cache: vin -> (expires_at, candidates)
_find_vehicle_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

# Process-local success cache: plate|cc -> (expires_at, ByPlateResult payload dict)
_plate_lookup_cache: dict[str, tuple[float, dict[str, Any]]] = {}

# Process-local success cache: frame -> (expires_at, ByFrameResult payload dict)
_frame_lookup_cache: dict[str, tuple[float, dict[str, Any]]] = {}


@dataclass
class ByVinResult:
    ok: bool
    reason: str
    message: Optional[str] = None
    candidates: list[NormalizedVehicleCandidate] = field(default_factory=list)

    def to_response_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "reason": self.reason,
            "message": self.message,
            "candidates": [c.to_dict() for c in self.candidates],
        }


@dataclass
class ByPlateResult:
    ok: bool
    reason: str
    message: Optional[str] = None
    plate: Optional[str] = None
    vin: Optional[str] = None
    candidates: list[NormalizedVehicleCandidate] = field(default_factory=list)

    def to_response_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "reason": self.reason,
            "message": self.message,
            "plate": self.plate,
            "vin": self.vin,
            "candidates": [c.to_dict() for c in self.candidates],
        }


@dataclass
class ByFrameResult:
    ok: bool
    reason: str
    message: Optional[str] = None
    frame: Optional[str] = None
    candidates: list[NormalizedVehicleCandidate] = field(default_factory=list)

    def to_response_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "reason": self.reason,
            "message": self.message,
            "frame": self.frame,
            "candidates": [c.to_dict() for c in self.candidates],
        }


def clear_find_vehicle_cache() -> None:
    _find_vehicle_cache.clear()


def clear_plate_lookup_cache() -> None:
    _plate_lookup_cache.clear()


def clear_frame_lookup_cache() -> None:
    _frame_lookup_cache.clear()


def _soft_unavailable() -> ByVinResult:
    _, message = public_message_for_reason(PUBLIC_TEMPORARILY_UNAVAILABLE)
    return ByVinResult(
        ok=False,
        reason=PUBLIC_TEMPORARILY_UNAVAILABLE,
        message=message,
        candidates=[],
    )


def _not_found() -> ByVinResult:
    _, message = public_message_for_reason(PUBLIC_NOT_FOUND)
    return ByVinResult(
        ok=False,
        reason=PUBLIC_NOT_FOUND,
        message=message,
        candidates=[],
    )


def _plate_soft_unavailable(plate: str) -> ByPlateResult:
    soft = _soft_unavailable()
    return ByPlateResult(
        ok=False,
        reason=soft.reason,
        message=soft.message,
        plate=plate,
        vin=None,
        candidates=[],
    )


def _plate_not_found(plate: str) -> ByPlateResult:
    soft = _not_found()
    return ByPlateResult(
        ok=False,
        reason=soft.reason,
        message=soft.message,
        plate=plate,
        vin=None,
        candidates=[],
    )


def _cache_get(vin: str) -> Optional[list[dict[str, Any]]]:
    entry = _find_vehicle_cache.get(vin)
    if not entry:
        return None
    expires_at, candidates = entry
    if time.monotonic() >= expires_at:
        _find_vehicle_cache.pop(vin, None)
        return None
    return candidates


def _cache_set(vin: str, candidates: list[dict[str, Any]]) -> None:
    _find_vehicle_cache[vin] = (time.monotonic() + CACHE_TTL_SEC, candidates)


def _plate_cache_key(plate: str, country_code: str) -> str:
    return f"{plate}|{(country_code or 'ru').strip().lower()}"


def _plate_cache_get(key: str) -> Optional[dict[str, Any]]:
    entry = _plate_lookup_cache.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if time.monotonic() >= expires_at:
        _plate_lookup_cache.pop(key, None)
        return None
    return payload


def _plate_cache_set(key: str, payload: dict[str, Any]) -> None:
    _plate_lookup_cache[key] = (time.monotonic() + CACHE_TTL_SEC, payload)


def lookup_by_vin(db: Session, vin: str) -> ByVinResult:
    """
    Gate → cache → FindVehicle → normalize.
    Soft-fails never expose quota / Laximo / upstream details.
    """
    normalized_vin = normalize_vin_or_raise(vin)

    if not laximo_cat_ready(db):
        return _soft_unavailable()

    cached = _cache_get(normalized_vin)
    if cached is not None:
        return ByVinResult(
            ok=True,
            reason=PUBLIC_OK,
            message=None,
            candidates=[normalize_find_vehicle_row(row) for row in cached],
        )

    try:
        rows = find_vehicle(db, normalized_vin, count_toward_quota=True)
    except LaximoCatError:
        logger.exception("Laximo FindVehicle failed for VIN lookup")
        return _soft_unavailable()
    except Exception:
        logger.exception("Unexpected error during Laximo FindVehicle")
        return _soft_unavailable()

    if not rows:
        return _not_found()

    _cache_set(normalized_vin, rows)
    return ByVinResult(
        ok=True,
        reason=PUBLIC_OK,
        message=None,
        candidates=[normalize_find_vehicle_row(row) for row in rows],
    )


def _lookup_vin_soft(db: Session, vin: str) -> ByVinResult:
    """FindVehicle for an already-validated VIN without raising on empty/errors."""
    if not looks_like_vin(vin):
        return _not_found()
    normalized = normalize_vin_or_none(vin)
    if not normalized:
        return _not_found()

    cached = _cache_get(normalized)
    if cached is not None:
        return ByVinResult(
            ok=True,
            reason=PUBLIC_OK,
            message=None,
            candidates=[normalize_find_vehicle_row(row) for row in cached],
        )

    try:
        rows = find_vehicle(db, normalized, count_toward_quota=True)
    except LaximoCatError:
        logger.info("FindVehicle soft-fail after plate identify for vin=%r", normalized)
        return _soft_unavailable()
    except Exception:
        logger.exception("Unexpected FindVehicle error after plate")
        return _soft_unavailable()

    if not rows:
        return _not_found()

    _cache_set(normalized, rows)
    return ByVinResult(
        ok=True,
        reason=PUBLIC_OK,
        message=None,
        candidates=[normalize_find_vehicle_row(row) for row in rows],
    )


def _plate_card_usable(card: dict[str, Any]) -> bool:
    if not isinstance(card, dict) or not card:
        return False
    vin = str(card.get("vin_number") or "").strip()
    if looks_like_vin(vin):
        return True
    mark = str(card.get("car_mark") or card.get("td_mark") or "").strip()
    model = str(card.get("car_model") or card.get("td_model") or "").strip()
    return bool(mark or model)


def _vin_from_find_vehicle_row(row: dict[str, Any]) -> Optional[str]:
    attrs = row.get("attributes") if isinstance(row.get("attributes"), list) else []
    for item in attrs:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip().lower()
        if key not in ("vin", "vin_number", "vincode"):
            continue
        vin = normalize_vin_or_none(str(item.get("value") or ""))
        if vin:
            return vin
    return None


def _lookup_by_plate_via_find_vehicle(
    db: Session,
    normalized_plate: str,
    cc: str,
) -> Optional[ByPlateResult]:
    try:
        rows = find_vehicle_by_plate_number(
            db,
            normalized_plate,
            country_code=cc,
            count_toward_quota=True,
        )
    except LaximoCatError as exc:
        if getattr(exc, "status_code", None) in (403, 404):
            return None
        raise

    if not rows:
        return None

    candidates = [normalize_find_vehicle_row(row) for row in rows]
    vin = None
    for row in rows:
        vin = _vin_from_find_vehicle_row(row)
        if vin:
            break

    return ByPlateResult(
        ok=True,
        reason=PUBLIC_OK,
        message=None,
        plate=normalized_plate,
        vin=vin,
        candidates=candidates,
    )


def _lookup_by_plate_via_identify_full(
    db: Session,
    normalized_plate: str,
    cc: str,
) -> ByPlateResult:
    card = identify_by_plate_number_full(
        db,
        normalized_plate,
        country_code=cc,
        count_toward_quota=True,
    )

    if not _plate_card_usable(card):
        return _plate_not_found(normalized_plate)

    vin_raw = str(card.get("vin_number") or "").strip().upper()
    vin = normalize_vin_or_none(vin_raw)

    candidates: list[NormalizedVehicleCandidate] = []
    if vin:
        vin_result = _lookup_vin_soft(db, vin)
        if vin_result.ok and vin_result.candidates:
            candidates = [
                enrich_candidate_from_plate_full(c, card) for c in vin_result.candidates
            ]
        else:
            fallback = normalize_plate_full_card(card)
            if fallback:
                candidates = [fallback]
            elif vin_result.reason == PUBLIC_TEMPORARILY_UNAVAILABLE:
                return _plate_soft_unavailable(normalized_plate)
    else:
        fallback = normalize_plate_full_card(card)
        if fallback:
            candidates = [fallback]

    if not candidates:
        return _plate_not_found(normalized_plate)

    return ByPlateResult(
        ok=True,
        reason=PUBLIC_OK,
        message=None,
        plate=normalized_plate,
        vin=vin,
        candidates=candidates,
    )


def lookup_by_plate(
    db: Session,
    plate: str,
    *,
    country_code: str = "ru",
) -> ByPlateResult:
    """
    Gate → cache → findVehicleByPlateNumber → fallback identifyByPlateNumberFull.
    Soft-fails never expose quota / Laximo / upstream details.
    """
    normalized_plate = normalize_plate_or_raise(plate)
    cc = (country_code or "ru").strip().lower() or "ru"
    cache_key = _plate_cache_key(normalized_plate, cc)

    if not laximo_cat_ready(db):
        return _plate_soft_unavailable(normalized_plate)

    cached = _plate_cache_get(cache_key)
    if cached is not None:
        rebuilt: list[NormalizedVehicleCandidate] = []
        for item in cached.get("candidates") or []:
            if isinstance(item, dict):
                rebuilt.append(NormalizedVehicleCandidate(**item))
        return ByPlateResult(
            ok=True,
            reason=PUBLIC_OK,
            message=None,
            plate=cached.get("plate") or normalized_plate,
            vin=cached.get("vin"),
            candidates=rebuilt,
        )

    try:
        result = _lookup_by_plate_via_find_vehicle(db, normalized_plate, cc)
        if result is None:
            try:
                result = _lookup_by_plate_via_identify_full(db, normalized_plate, cc)
            except LaximoCatError as exc:
                if getattr(exc, "status_code", None) == 404:
                    return _plate_not_found(normalized_plate)
                logger.exception("Laximo plate identify fallback failed")
                return _plate_soft_unavailable(normalized_plate)
    except LaximoCatError as exc:
        if getattr(exc, "status_code", None) == 404:
            return _plate_not_found(normalized_plate)
        logger.exception("Laximo findVehicleByPlateNumber failed")
        return _plate_soft_unavailable(normalized_plate)
    except Exception:
        logger.exception("Unexpected error during plate lookup")
        return _plate_soft_unavailable(normalized_plate)

    if not result.ok:
        return result

    _plate_cache_set(
        cache_key,
        {
            "plate": normalized_plate,
            "vin": result.vin,
            "candidates": [c.to_dict() for c in result.candidates],
        },
    )
    return result


def _frame_soft_unavailable(frame: str) -> ByFrameResult:
    soft = _soft_unavailable()
    return ByFrameResult(
        ok=False,
        reason=soft.reason,
        message=soft.message,
        frame=frame,
        candidates=[],
    )


def _frame_not_found(frame: str) -> ByFrameResult:
    soft = _not_found()
    return ByFrameResult(
        ok=False,
        reason=soft.reason,
        message=soft.message,
        frame=frame,
        candidates=[],
    )


def _frame_cache_get(key: str) -> Optional[dict[str, Any]]:
    entry = _frame_lookup_cache.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if time.monotonic() >= expires_at:
        _frame_lookup_cache.pop(key, None)
        return None
    return payload


def _frame_cache_set(key: str, payload: dict[str, Any]) -> None:
    _frame_lookup_cache[key] = (time.monotonic() + CACHE_TTL_SEC, payload)


def lookup_by_frame(db: Session, frame: str) -> ByFrameResult:
    """
    Gate → cache → FindVehicle(identString=frame) → normalize.
    Soft-fails never expose quota / Laximo / upstream details.
    """
    normalized_frame = normalize_frame_or_raise(frame)

    if not laximo_cat_ready(db):
        return _frame_soft_unavailable(normalized_frame)

    cached = _frame_cache_get(normalized_frame)
    if cached is not None:
        rebuilt: list[NormalizedVehicleCandidate] = []
        for item in cached.get("candidates") or []:
            if isinstance(item, dict):
                rebuilt.append(NormalizedVehicleCandidate(**item))
        return ByFrameResult(
            ok=True,
            reason=PUBLIC_OK,
            message=None,
            frame=cached.get("frame") or normalized_frame,
            candidates=rebuilt,
        )

    try:
        rows = find_vehicle(db, normalized_frame, count_toward_quota=True)
    except LaximoCatError:
        logger.exception("Laximo FindVehicle failed for Frame lookup")
        return _frame_soft_unavailable(normalized_frame)
    except Exception:
        logger.exception("Unexpected error during Laximo FindVehicle (frame)")
        return _frame_soft_unavailable(normalized_frame)

    if not rows:
        return _frame_not_found(normalized_frame)

    candidates = [normalize_find_vehicle_row(row) for row in rows]
    result = ByFrameResult(
        ok=True,
        reason=PUBLIC_OK,
        message=None,
        frame=normalized_frame,
        candidates=candidates,
    )
    _frame_cache_set(
        normalized_frame,
        {
            "frame": normalized_frame,
            "candidates": [c.to_dict() for c in candidates],
        },
    )
    return result
