from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models.product import Product as ProductModel
from app.models.seo_rossko_seed_queue import SeoRosskoSeedQueue
from app.utils.json_cache_sync import get_cached_json_sync, set_cached_json_sync
from app.utils.partnumber import build_product_lookup_key, normalize_partnumber

FITMENT_CACHE_TTL_SECONDS = 86400
_VEHICLE_LIST_KEYS = frozenset(
    {
        "vehicles",
        "vehicle",
        "applicability",
        "applicable",
        "cars",
        "models",
        "passengercars",
        "passenger_cars",
    }
)
_BRAND_KEYS = frozenset({"brand", "manufacturer", "make", "marka", "марка"})
_MODEL_KEYS = frozenset({"model", "модель"})
_GENERATION_KEYS = frozenset({"generation", "modification", "series", "поколение"})


@dataclass(frozen=True)
class ReferenceFitmentVehicle:
    brand: str
    model: str
    generation: str = ""

    def to_dict(self) -> dict[str, str]:
        payload = {"brand": self.brand, "model": self.model, "source": "reference"}
        if self.generation:
            payload["generation"] = self.generation
        return payload


def _sql_normalize_article(column):
    expr = func.upper(column)
    for ch in ("-", " ", ".", "/", "(", ")", "_", "\\"):
        expr = func.replace(expr, ch, "")
    return expr


def _fitment_cache_key(brand: str, article: str) -> str:
    lookup = build_product_lookup_key(brand, article)
    return f"fitment:ref:{lookup}" if lookup else ""


def _normalize_token(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _fitment_dedupe_key(brand: str, model: str, generation: str = "") -> str:
    return "|".join(
        part.casefold()
        for part in (_normalize_token(brand), _normalize_token(model), _normalize_token(generation))
    )


def merge_fitment_vehicles(
    seller_vehicles: list[dict[str, Any]] | None,
    reference_vehicles: list[dict[str, Any]] | None,
    *,
    limit: int = 24,
) -> list[dict[str, str]]:
    merged: list[dict[str, str]] = []
    seen: set[str] = set()

    def _append(brand: str, model: str, generation: str = "", source: str = "reference") -> None:
        brand_text = _normalize_token(brand)
        model_text = _normalize_token(model)
        if not brand_text or not model_text:
            return
        key = _fitment_dedupe_key(brand_text, model_text, generation)
        if key in seen:
            return
        seen.add(key)
        item = {"brand": brand_text, "model": model_text, "source": source}
        generation_text = _normalize_token(generation)
        if generation_text:
            item["generation"] = generation_text
        merged.append(item)

    for vehicle in seller_vehicles or []:
        if not isinstance(vehicle, dict):
            continue
        _append(
            vehicle.get("brand"),
            vehicle.get("model"),
            vehicle.get("generation") or "",
            "seller",
        )
        if len(merged) >= limit:
            return merged[:limit]

    for vehicle in reference_vehicles or []:
        if not isinstance(vehicle, dict):
            continue
        _append(
            vehicle.get("brand"),
            vehicle.get("model"),
            vehicle.get("generation") or "",
            vehicle.get("source") or "reference",
        )
        if len(merged) >= limit:
            return merged[:limit]

    return merged[:limit]


def format_fitment_text(vehicles: list[dict[str, str]] | None, *, limit: int = 10) -> str:
    labels: list[str] = []
    for vehicle in vehicles or []:
        brand = _normalize_token(vehicle.get("brand"))
        model = _normalize_token(vehicle.get("model"))
        if not brand or not model:
            continue
        generation = _normalize_token(vehicle.get("generation"))
        labels.append(" ".join(part for part in (brand, model, generation) if part))
        if len(labels) >= limit:
            break
    return ", ".join(labels)


def _extract_vehicle_from_mapping(data: dict[str, Any]) -> ReferenceFitmentVehicle | None:
    brand = ""
    model = ""
    generation = ""
    for key, value in data.items():
        key_text = str(key or "").casefold()
        text = _normalize_token(value)
        if not text:
            continue
        if key_text in _BRAND_KEYS:
            brand = text
        elif key_text in _MODEL_KEYS:
            model = text
        elif key_text in _GENERATION_KEYS:
            generation = text
    if brand and model:
        return ReferenceFitmentVehicle(brand=brand, model=model, generation=generation)
    return None


def _walk_payload_for_vehicles(node: Any, found: list[ReferenceFitmentVehicle], *, depth: int = 0) -> None:
    if depth > 8 or len(found) >= 24:
        return
    if isinstance(node, dict):
        vehicle = _extract_vehicle_from_mapping(node)
        if vehicle:
            found.append(vehicle)
        for key, value in node.items():
            key_text = str(key or "").casefold()
            if key_text in _VEHICLE_LIST_KEYS and isinstance(value, list):
                for item in value:
                    _walk_payload_for_vehicles(item, found, depth=depth + 1)
            else:
                _walk_payload_for_vehicles(value, found, depth=depth + 1)
    elif isinstance(node, list):
        for item in node[:40]:
            _walk_payload_for_vehicles(item, found, depth=depth + 1)


def _parse_payload_vehicles(payload: object) -> list[ReferenceFitmentVehicle]:
    found: list[ReferenceFitmentVehicle] = []
    _walk_payload_for_vehicles(payload, found)
    deduped: list[ReferenceFitmentVehicle] = []
    seen: set[str] = set()
    for vehicle in found:
        key = _fitment_dedupe_key(vehicle.brand, vehicle.model, vehicle.generation)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(vehicle)
    return deduped[:24]


def _load_seed_payload_vehicles(db: Session, brand: str, article: str) -> list[ReferenceFitmentVehicle]:
    lookup_key = build_product_lookup_key(brand, article)
    if not lookup_key:
        return []
    row = (
        db.query(SeoRosskoSeedQueue)
        .filter(
            SeoRosskoSeedQueue.lookup_key == lookup_key,
            SeoRosskoSeedQueue.rossko_payload_json.isnot(None),
        )
        .first()
    )
    if not row or not row.rossko_payload_json:
        return []
    try:
        payload = json.loads(row.rossko_payload_json)
    except json.JSONDecodeError:
        return []
    return _parse_payload_vehicles(payload)


def _load_catalog_reference_vehicles(
    db: Session,
    brand: str,
    article: str,
    *,
    exclude_product_id: int | None = None,
) -> list[ReferenceFitmentVehicle]:
    brand_text = _normalize_token(brand)
    article_text = _normalize_token(article)
    if not brand_text or not article_text:
        return []

    load_options = (selectinload(ProductModel.compatible_vehicles),)
    query = (
        db.query(ProductModel)
        .options(*load_options)
        .filter(
            ProductModel.quantity > 0,
            ProductModel.is_new.is_(False),
            ProductModel.brand.ilike(brand_text),
            ProductModel.article.ilike(article_text),
        )
        .order_by(ProductModel.id.desc())
        .limit(20)
    )
    products = query.all()
    if not products:
        normalized_article = normalize_partnumber(article_text)
        if normalized_article:
            products = (
                db.query(ProductModel)
                .options(*load_options)
                .filter(
                    ProductModel.quantity > 0,
                    ProductModel.is_new.is_(False),
                    ProductModel.brand.ilike(brand_text),
                    _sql_normalize_article(ProductModel.article) == normalized_article,
                )
                .order_by(ProductModel.id.desc())
                .limit(20)
                .all()
            )

    found: list[ReferenceFitmentVehicle] = []
    seen: set[str] = set()
    for product in products:
        if exclude_product_id is not None and int(product.id) == int(exclude_product_id):
            continue
        for vehicle in product.compatible_vehicles or []:
            brand_name = _normalize_token(getattr(vehicle, "brand", None))
            model_name = _normalize_token(getattr(vehicle, "model", None))
            if not brand_name or not model_name:
                continue
            generation = _normalize_token(getattr(vehicle, "generation", None))
            key = _fitment_dedupe_key(brand_name, model_name, generation)
            if key in seen:
                continue
            seen.add(key)
            found.append(ReferenceFitmentVehicle(brand=brand_name, model=model_name, generation=generation))
            if len(found) >= 24:
                return found
    return found


def get_reference_fitment_vehicles(
    db: Session,
    *,
    brand: str,
    article: str,
    exclude_product_id: int | None = None,
) -> list[dict[str, str]]:
    brand_text = _normalize_token(brand)
    article_text = _normalize_token(article)
    if not brand_text or not article_text:
        return []

    cache_key = _fitment_cache_key(brand_text, article_text)
    if cache_key:
        cached = get_cached_json_sync(cache_key)
        if isinstance(cached, list):
            return [item for item in cached if isinstance(item, dict)]

    vehicles: list[ReferenceFitmentVehicle] = []
    seen: set[str] = set()

    def _add_many(items: list[ReferenceFitmentVehicle]) -> None:
        for item in items:
            key = _fitment_dedupe_key(item.brand, item.model, item.generation)
            if key in seen:
                continue
            seen.add(key)
            vehicles.append(item)
            if len(vehicles) >= 24:
                return

    _add_many(_load_seed_payload_vehicles(db, brand_text, article_text))
    if len(vehicles) < 24:
        _add_many(
            _load_catalog_reference_vehicles(
                db,
                brand_text,
                article_text,
                exclude_product_id=exclude_product_id,
            )
        )

    result = [vehicle.to_dict() for vehicle in vehicles[:24]]
    if cache_key:
        set_cached_json_sync(cache_key, result, FITMENT_CACHE_TTL_SECONDS)
    return result
