from __future__ import annotations

import json
import re
from pathlib import Path

from app.utils.partnumber import build_product_lookup_key, normalize_partnumber

_SEMANTIC_MAP_PATH = (
    Path(__file__).resolve().parents[3] / "docs" / "seo" / "semantic-map.md"
)
_JSON_PAIRS_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "seo_semantic_seed_pairs.json"
)

_URL_PAIR_RE = re.compile(
    r"/autoparts/new/part/\{id\}-([a-z0-9-]+)-([a-z0-9-]+)",
    re.IGNORECASE,
)
_QUERY_PAIR_RE = re.compile(
    r"\b([a-z][a-z0-9-]{1,30})\s+([a-z0-9][a-z0-9./_-]{2,30})\b",
    re.IGNORECASE,
)
_ARTICLE_BMW_RE = re.compile(
    r"артикул\s+(\d{5,})\s+bmw",
    re.IGNORECASE,
)

_FALLBACK_PAIRS: list[tuple[str, str]] = [
    ("BOSCH", "0986424590"),
    ("MANN", "W712/75"),
    ("NGK", "96535"),
    ("FEBI", "37424"),
    ("KNECHT", "OX188"),
    ("SAKURA", "FC1101"),
    ("KAYABA", "334001"),
    ("HYUNDAI", "2630035504"),
    ("GRAF", "PA1234"),
    ("BMW", "34116761280"),
    ("BOSCH", "0986AB1234"),
    ("MANN", "HU816X"),
    ("VALEO", "803742"),
    ("SACHS", "3151003241"),
    ("MAHLE", "KX331/22D"),
    ("DENSO", "DUN9"),
    ("BREMBO", "P85020"),
    ("ATE", "13046028702"),
    ("LEMFORDER", "2540201"),
    ("FORD", "1779644"),
]


def _normalize_pair(brand: str, article: str) -> tuple[str, str] | None:
    brand_text = (brand or "").strip()
    article_text = (article or "").strip()
    if not brand_text or not article_text:
        return None
    if brand_text.lower() in {"new", "card", "то", "same", "category", "part"}:
        return None
    lookup_key = build_product_lookup_key(brand_text, article_text)
    if not lookup_key:
        return None
    return brand_text.upper(), article_text


def _slug_to_brand(slug: str) -> str:
    return slug.replace("-", " ").upper()


def _extract_pairs_from_semantic_map(text: str) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    seen: set[str] = set()
    in_cluster_a = False

    for line in text.splitlines():
        if "## Кластер A" in line:
            in_cluster_a = True
            continue
        if in_cluster_a and line.startswith("## "):
            break
        if not in_cluster_a or not line.startswith("|"):
            continue
        if line.startswith("| #") or line.startswith("|---"):
            continue

        for match in _URL_PAIR_RE.finditer(line):
            brand_slug, article_slug = match.group(1), match.group(2)
            pair = _normalize_pair(_slug_to_brand(brand_slug), article_slug.replace("-", ""))
            if pair and pair[1] not in seen:
                seen.add(build_product_lookup_key(pair[0], pair[1]) or "")
                pairs.append(pair)

        bmw_match = _ARTICLE_BMW_RE.search(line)
        if bmw_match:
            pair = _normalize_pair("BMW", bmw_match.group(1))
            if pair:
                key = build_product_lookup_key(pair[0], pair[1])
                if key and key not in seen:
                    seen.add(key)
                    pairs.append(pair)

        query_cell = line.split("|")[2] if line.count("|") >= 3 else ""
        for match in _QUERY_PAIR_RE.finditer(query_cell):
            brand_raw, article_raw = match.group(1), match.group(2)
            if brand_raw.lower() in {"купить", "цена", "оригинал", "запчасть", "амортизатор", "фильтр", "свечи"}:
                continue
            pair = _normalize_pair(brand_raw, article_raw)
            if not pair:
                continue
            key = build_product_lookup_key(pair[0], pair[1])
            if key and key not in seen and normalize_partnumber(pair[1]):
                seen.add(key)
                pairs.append(pair)

    return pairs


def _load_json_pairs() -> list[tuple[str, str]]:
    if not _JSON_PAIRS_PATH.is_file():
        return []
    try:
        data = json.loads(_JSON_PAIRS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    pairs: list[tuple[str, str]] = []
    for item in data if isinstance(data, list) else []:
        if not isinstance(item, dict):
            continue
        pair = _normalize_pair(str(item.get("brand", "")), str(item.get("article", "")))
        if pair:
            pairs.append(pair)
    return pairs


def load_semantic_seed_pairs() -> list[tuple[str, str]]:
    seen: set[str] = set()
    merged: list[tuple[str, str]] = []

    def add_pair(brand: str, article: str) -> None:
        pair = _normalize_pair(brand, article)
        if not pair:
            return
        key = build_product_lookup_key(pair[0], pair[1])
        if not key or key in seen:
            return
        seen.add(key)
        merged.append(pair)

    if _SEMANTIC_MAP_PATH.is_file():
        try:
            text = _SEMANTIC_MAP_PATH.read_text(encoding="utf-8")
            for brand, article in _extract_pairs_from_semantic_map(text):
                add_pair(brand, article)
        except OSError:
            pass

    for brand, article in _load_json_pairs():
        add_pair(brand, article)

    for brand, article in _FALLBACK_PAIRS:
        add_pair(brand, article)

    return merged
