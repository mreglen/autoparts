from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.pending_product import PendingProduct as PendingProductModel
from app.models.pending_product_storage_cell import PendingProductStorageCell as PendingProductStorageCellModel
from app.models.storage_cell import StorageCell as StorageCellModel


def attach_storage_cells_to_pending_product(
    db: Session,
    *,
    pending_product_id: int,
    organization_id: str,
    storage_cells: list[dict[str, Any]],
) -> int:
    """Привязать ячейки адресного хранения к pending product. Возвращает число сохранённых связей."""
    if not storage_cells:
        return 0

    pending_product = (
        db.query(PendingProductModel)
        .filter(
            PendingProductModel.id == pending_product_id,
            PendingProductModel.organization_id == organization_id,
        )
        .first()
    )
    if not pending_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pending product {pending_product_id} не найден",
        )

    saved_count = 0
    for item in storage_cells:
        cell_id_raw = item.get("storage_cell_id")
        value = str(item.get("value") or "").strip()
        if cell_id_raw is None or not value:
            continue
        try:
            storage_cell_id = int(cell_id_raw)
        except (TypeError, ValueError):
            continue

        storage_cell = (
            db.query(StorageCellModel)
            .options(joinedload(StorageCellModel.storage_location))
            .filter(StorageCellModel.id == storage_cell_id)
            .first()
        )
        if not storage_cell:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storage cell {storage_cell_id} не найден",
            )

        storage_location = storage_cell.storage_location
        if not storage_location or storage_location.organization_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Storage cell {storage_cell_id} не принадлежит вашей организации",
            )

        existing_link = (
            db.query(PendingProductStorageCellModel)
            .filter(
                PendingProductStorageCellModel.pending_product_id == pending_product_id,
                PendingProductStorageCellModel.storage_cell_id == storage_cell_id,
            )
            .first()
        )
        if existing_link:
            existing_link.value = value
            saved_count += 1
            continue

        db.add(
            PendingProductStorageCellModel(
                pending_product_id=pending_product_id,
                storage_cell_id=storage_cell_id,
                value=value,
            )
        )
        saved_count += 1

    if saved_count:
        db.commit()
    return saved_count
