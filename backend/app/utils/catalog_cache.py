from __future__ import annotations

import hashlib
import json
from typing import Any


def build_catalog_cache_key(prefix: str, **params: Any) -> str:
    normalized: dict[str, Any] = {}
    for key in sorted(params):
        value = params[key]
        if value is None:
            continue
        if isinstance(value, list):
            normalized[key] = sorted(str(item) for item in value)
        else:
            normalized[key] = value
    digest = hashlib.sha256(
        json.dumps(normalized, sort_keys=True, default=str).encode("utf-8")
    ).hexdigest()[:32]
    return f"{prefix}:{digest}"
