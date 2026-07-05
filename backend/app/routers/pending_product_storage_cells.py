from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.pending_product_storage_cell import PendingProductStorageCell as PendingProductStorageCellModel
from app.models.pending_product import PendingProduct as PendingProductModel
from app.models.storage_cell import StorageCell as StorageCellModel
from app.models.user import User
from app.core.auth import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/pending-product-storage-cells", tags=["Pending Product Storage Cells"])

# Pydantic models for request/response
class PendingProductStorageCellCreate(BaseModel):
    pending_product_id: int
    storage_cell_id: int
    value: str

class PendingProductStorageCellResponse(BaseModel):
    id: int
    pending_product_id: int
    storage_cell_id: int
    value: str
    
    class Config:
        from_attributes = True


class PendingProductsStorageCellsRequest(BaseModel):
    pending_product_ids: List[int]

@router.post("/", response_model=PendingProductStorageCellResponse)
def create_pending_product_storage_cell(
    cell_data: PendingProductStorageCellCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать связь между pending product и storage cell"""
    
    # Проверяем существование pending product
    pending_product = db.query(PendingProductModel).filter(
        PendingProductModel.id == cell_data.pending_product_id,
        PendingProductModel.organization_id == current_user.organization_id
    ).first()
    
    if not pending_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending product не найден"
        )
    
    # Проверяем существование storage cell
    storage_cell = db.query(StorageCellModel).filter(
        StorageCellModel.id == cell_data.storage_cell_id
    ).first()
    
    if not storage_cell:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Storage cell не найден"
        )
    
    # Проверяем, что storage cell принадлежит той же организации
    storage_location = storage_cell.storage_location
    if not storage_location or storage_location.organization_id != current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Storage cell не принадлежит вашей организации"
        )
    
    # Проверяем, что связь еще не существует
    existing_link = db.query(PendingProductStorageCellModel).filter(
        PendingProductStorageCellModel.pending_product_id == cell_data.pending_product_id,
        PendingProductStorageCellModel.storage_cell_id == cell_data.storage_cell_id
    ).first()
    
    if existing_link:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Связь уже существует"
        )
    
    # Создаем новую связь
    db_link = PendingProductStorageCellModel(
        pending_product_id=cell_data.pending_product_id,
        storage_cell_id=cell_data.storage_cell_id,
        value=cell_data.value
    )
    
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    
    return db_link

@router.post("/batch", response_model=List[PendingProductStorageCellResponse])
def create_pending_product_storage_cells_batch(
    cells_data: List[PendingProductStorageCellCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать несколько связей между pending products и storage cells"""
    
    created_links = []
    
    for cell_data in cells_data:
        # Проверяем существование pending product
        pending_product = db.query(PendingProductModel).filter(
            PendingProductModel.id == cell_data.pending_product_id,
            PendingProductModel.organization_id == current_user.organization_id
        ).first()
        
        if not pending_product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pending product {cell_data.pending_product_id} не найден"
            )
        
        # Проверяем существование storage cell
        storage_cell = db.query(StorageCellModel).filter(
            StorageCellModel.id == cell_data.storage_cell_id
        ).first()
        
        if not storage_cell:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Storage cell {cell_data.storage_cell_id} не найден"
            )
        
        # Проверяем, что storage cell принадлежит той же организации
        storage_location = storage_cell.storage_location
        if not storage_location or storage_location.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Storage cell {cell_data.storage_cell_id} не принадлежит вашей организации"
            )
        
        # Проверяем, что связь еще не существует
        existing_link = db.query(PendingProductStorageCellModel).filter(
            PendingProductStorageCellModel.pending_product_id == cell_data.pending_product_id,
            PendingProductStorageCellModel.storage_cell_id == cell_data.storage_cell_id
        ).first()
        
        if existing_link:
            # Пропускаем дубликаты вместо ошибки
            continue
        
        # Создаем новую связь
        db_link = PendingProductStorageCellModel(
            pending_product_id=cell_data.pending_product_id,
            storage_cell_id=cell_data.storage_cell_id,
            value=cell_data.value
        )
        
        db.add(db_link)
        created_links.append(db_link)
    
    db.commit()
    
    # Обновляем все созданные ссылки
    for link in created_links:
        db.refresh(link)
    
    return created_links

@router.get("/", response_model=List[PendingProductStorageCellResponse])
def get_pending_product_storage_cells(
    pending_product_id: int = None,
    storage_cell_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить связи между pending products и storage cells"""
    
    query = db.query(PendingProductStorageCellModel)
    
    # Фильтрация по pending product (с проверкой прав доступа)
    if pending_product_id:
        pending_product = db.query(PendingProductModel).filter(
            PendingProductModel.id == pending_product_id,
            PendingProductModel.organization_id == current_user.organization_id
        ).first()
        
        if not pending_product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Pending product не найден"
            )
        
        query = query.filter(PendingProductStorageCellModel.pending_product_id == pending_product_id)
    
    # Фильтрация по storage cell (с проверкой прав доступа)
    if storage_cell_id:
        storage_cell = db.query(StorageCellModel).filter(
            StorageCellModel.id == storage_cell_id
        ).first()
        
        if not storage_cell:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Storage cell не найден"
            )
        
        storage_location = storage_cell.storage_location
        if not storage_location or storage_location.organization_id != current_user.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Storage cell не принадлежит вашей организации"
            )
        
        query = query.filter(PendingProductStorageCellModel.storage_cell_id == storage_cell_id)
    
    links = query.all()
    return links


@router.post("/by-pending-products", response_model=List[PendingProductStorageCellResponse])
def read_pending_product_storage_cells_by_products(
    payload: PendingProductsStorageCellsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить связи ячеек для нескольких pending products одним запросом."""
    unique_ids = list(dict.fromkeys(payload.pending_product_ids))
    if not unique_ids:
        return []

    allowed_ids = {
        row[0]
        for row in db.query(PendingProductModel.id).filter(
            PendingProductModel.id.in_(unique_ids),
            PendingProductModel.organization_id == current_user.organization_id,
        ).all()
    }
    if not allowed_ids:
        return []

    return (
        db.query(PendingProductStorageCellModel)
        .filter(PendingProductStorageCellModel.pending_product_id.in_(allowed_ids))
        .all()
    )


@router.delete("/{link_id}")
def delete_pending_product_storage_cell(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить связь между pending product и storage cell"""
    
    link = db.query(PendingProductStorageCellModel).filter(
        PendingProductStorageCellModel.id == link_id
    ).first()
    
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Связь не найдена"
        )
    
    # Проверяем права доступа через pending product
    pending_product = db.query(PendingProductModel).filter(
        PendingProductModel.id == link.pending_product_id,
        PendingProductModel.organization_id == current_user.organization_id
    ).first()
    
    if not pending_product:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Связь не принадлежит вашей организации"
        )
    
    db.delete(link)
    db.commit()
    
    return {"message": "Связь успешно удалена"}