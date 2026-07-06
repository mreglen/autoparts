from __future__ import annotations

import json
import os
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.product_draft import ProductDraft as ProductDraftModel
from app.models.user import User
from app.schemas.pending_product import PendingProductCreate
from app.schemas.product_draft import ProductDraftCreate, ProductDraftUpdate


def require_organization(user: User) -> None:
    if not user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не привязан к организации",
        )


def parse_json_list(raw: str | None) -> list:
    if not raw:
        return []
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else []
    except Exception:
        return []


def parse_storage_cells(raw: str | None) -> list[dict[str, Any]]:
    if not raw:
        return []
    try:
        value = json.loads(raw)
        return value if isinstance(value, list) else []
    except Exception:
        return []


def dump_json_list(value: list | None) -> str | None:
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


def _storage_cell_item_fields(item) -> tuple[int | None, str]:
    if isinstance(item, dict):
        cell_id = item.get("storage_cell_id")
        cell_value = str(item.get("value") or "")
    else:
        cell_id = getattr(item, "storage_cell_id", None)
        cell_value = str(getattr(item, "value", None) or "")
    try:
        parsed_id = int(cell_id) if cell_id is not None else None
    except (TypeError, ValueError):
        parsed_id = None
    return parsed_id, cell_value


def dump_storage_cells(value: list | None) -> str | None:
    if value is None:
        return None
    payload = []
    for item in value:
        cell_id, cell_value = _storage_cell_item_fields(item)
        if cell_id is None:
            continue
        payload.append(
            {
                "storage_cell_id": cell_id,
                "value": cell_value,
            }
        )
    return json.dumps(payload, ensure_ascii=False)


def serialize_draft(draft: ProductDraftModel) -> dict[str, Any]:
    return {
        "id": draft.id,
        "organization_id": draft.organization_id,
        "created_by": draft.created_by,
        "created_at": draft.created_at,
        "updated_at": draft.updated_at,
        "article": draft.article,
        "name": draft.name,
        "brand": draft.brand,
        "description": draft.description,
        "is_new": draft.is_new if draft.is_new is not None else True,
        "price": float(draft.price) if draft.price is not None else None,
        "quantity": draft.quantity,
        "storage_location_id": draft.storage_location_id,
        "part_type_id": draft.part_type_id,
        "photos": parse_json_list(draft.photos),
        "videos": parse_json_list(draft.videos),
        "vehicle_ids": parse_json_list(draft.vehicle_ids),
        "storage_cells": parse_storage_cells(draft.storage_cells_json),
        "creator_name": draft.creator_name,
    }


def get_owned_draft(db: Session, draft_id: int, user: User) -> ProductDraftModel:
    require_organization(user)
    draft = (
        db.query(ProductDraftModel)
        .filter(
            ProductDraftModel.id == draft_id,
            ProductDraftModel.organization_id == user.organization_id,
            ProductDraftModel.created_by == user.id,
        )
        .first()
    )
    if draft is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Черновик не найден")
    return draft


def apply_draft_payload(draft: ProductDraftModel, payload: ProductDraftCreate | ProductDraftUpdate) -> None:
    data = payload.model_dump(exclude_unset=True)
    storage_cells = data.pop("storage_cells", None)

    for json_field in ("photos", "videos", "vehicle_ids"):
        if json_field in data:
            setattr(draft, json_field, dump_json_list(data.pop(json_field)))

    for field, value in data.items():
        setattr(draft, field, value)

    if storage_cells is not None:
        draft.storage_cells_json = dump_storage_cells(storage_cells)


def draft_has_content(payload: ProductDraftCreate) -> bool:
    if any(
        [
            (payload.article or "").strip(),
            (payload.name or "").strip(),
            (payload.brand or "").strip(),
            (payload.description or "").strip(),
        ]
    ):
        return True
    if payload.photos or payload.videos:
        return True
    if payload.storage_location_id or payload.part_type_id:
        return True
    if payload.price is not None or payload.quantity is not None:
        return True
    if payload.storage_cells:
        return True
    if payload.vehicle_ids:
        return True
    return False


def temp_filename_from_path(path: str) -> str | None:
    if not isinstance(path, str) or not path.startswith("/temp/"):
        return None
    parts = path.lstrip("/").split("/")
    if len(parts) < 3 or parts[0] != "temp":
        return None
    return parts[-1]


def delete_temp_media_paths(paths: list[str]) -> None:
    for path in paths:
        filename = temp_filename_from_path(path)
        if not filename:
            continue
        parts = path.lstrip("/").split("/")
        if len(parts) >= 3:
            org_id = parts[1]
            abs_path = os.path.abspath(os.path.join("uploads", "temp", org_id, filename))
            if os.path.exists(abs_path):
                try:
                    os.remove(abs_path)
                except OSError:
                    pass


def cleanup_draft_temp_media(draft: ProductDraftModel) -> None:
    photos = parse_json_list(draft.photos)
    videos = parse_json_list(draft.videos)
    delete_temp_media_paths([*photos, *videos])


def build_pending_payload(draft: ProductDraftModel) -> PendingProductCreate:
    photos = parse_json_list(draft.photos)
    videos = parse_json_list(draft.videos)
    vehicle_ids = parse_json_list(draft.vehicle_ids)
    return PendingProductCreate(
        article=(draft.article or "").strip(),
        name=(draft.name or "").strip(),
        brand=(draft.brand or "").strip(),
        description=(draft.description or "").strip() or None,
        is_new=bool(draft.is_new),
        price=float(draft.price) if draft.price is not None else None,
        quantity=int(draft.quantity) if draft.quantity is not None else None,
        storage_location_id=draft.storage_location_id,
        part_type_id=draft.part_type_id,
        photos=photos or None,
        videos=videos or None,
        vehicle_ids=vehicle_ids or None,
    )
