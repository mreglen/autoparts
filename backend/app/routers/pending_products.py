from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import json

from app.db.database import get_db
from app.models.pending_product import PendingProduct as PendingProductModel
from app.models.user import User
from app.schemas.pending_product import PendingProductCreate, PendingProduct, PendingProductUpdate
from app.core.auth import get_current_user
# Sequential code generation is handled inline

router = APIRouter(prefix="/pending-products", tags=["Pending Products"])


@router.post("/", response_model=PendingProduct)
def create_pending_product(
    product_data: PendingProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую запчасть в статусе ожидания модерации"""
    
    # Генерируем последовательный числовой внутренний код
    # Находим все существующие internal_code для организации
    existing_codes_result = db.query(PendingProductModel.internal_code).all()
    
    # Извлекаем существующие коды как строки
    existing_codes = [code_tuple[0] for code_tuple in existing_codes_result]
    
    # Начинаем с 1 и находим следующий свободный код в формате 00001
    next_code = 1
    while True:
        candidate_code = f"{next_code:05d}"  # Формат 00001, 00002, etc.
        if candidate_code not in existing_codes:
            internal_code = candidate_code
            break
        next_code += 1
    
    # Преобразуем списки в JSON строки
    photos_json = json.dumps(product_data.photos) if product_data.photos else None
    videos_json = json.dumps(product_data.videos) if product_data.videos else None
    vehicle_ids_json = json.dumps(product_data.vehicle_ids) if product_data.vehicle_ids else None
    
    # Создаем запись
    db_product = PendingProductModel(
        article=product_data.article,
        name=product_data.name,
        brand=product_data.brand,
        description=product_data.description,
        is_new=product_data.is_new,
        price=product_data.price,
        quantity=product_data.quantity,
        storage_location_id=product_data.storage_location_id,
        photos=photos_json,
        videos=videos_json,
        vehicle_ids=vehicle_ids_json,
        internal_code=internal_code,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Преобразуем JSON строки обратно в списки для ответа
    product_dict = db_product.__dict__.copy()
    if product_dict.get('photos'):
        try:
            product_dict['photos'] = json.loads(product_dict['photos'])
        except:
            product_dict['photos'] = []
    else:
        product_dict['photos'] = []
    
    if product_dict.get('videos'):
        try:
            product_dict['videos'] = json.loads(product_dict['videos'])
        except:
            product_dict['videos'] = []
    else:
        product_dict['videos'] = []
        
    if product_dict.get('vehicle_ids'):
        try:
            product_dict['vehicle_ids'] = json.loads(product_dict['vehicle_ids'])
        except:
            product_dict['vehicle_ids'] = []
    else:
        product_dict['vehicle_ids'] = []
        
    # Удаляем SQLAlchemy состояние
    product_dict.pop('_sa_instance_state', None)
    
    return product_dict


@router.get("/", response_model=List[PendingProduct])
def get_pending_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список всех запчастей в ожидании модерации для организации пользователя"""
    
    products = db.query(PendingProductModel)\
        .filter(PendingProductModel.organization_id == current_user.organization_id)\
        .offset(skip)\
        .limit(limit)\
        .all()


@router.get("/my", response_model=List[PendingProduct])
def get_my_pending_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список запчастей в ожидании модерации, созданных текущим пользователем"""
    
    products = db.query(PendingProductModel)\
        .filter(PendingProductModel.created_by == current_user.id)\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    # Преобразуем JSON строки обратно в списки
    result = []
    for product in products:
        product_dict = product.__dict__.copy()
        if product_dict.get('photos'):
            try:
                product_dict['photos'] = json.loads(product_dict['photos'])
            except:
                product_dict['photos'] = []
        else:
            product_dict['photos'] = []
        
        if product_dict.get('videos'):
            try:
                product_dict['videos'] = json.loads(product_dict['videos'])
            except:
                product_dict['videos'] = []
        else:
            product_dict['videos'] = []
            
        if product_dict.get('vehicle_ids'):
            try:
                product_dict['vehicle_ids'] = json.loads(product_dict['vehicle_ids'])
            except:
                product_dict['vehicle_ids'] = []
        else:
            product_dict['vehicle_ids'] = []
            
        # Удаляем SQLAlchemy состояние
        product_dict.pop('_sa_instance_state', None)
        result.append(product_dict)
    
    return result


@router.get("/{product_id}", response_model=PendingProduct)
def get_pending_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить конкретную запчасть в ожидании модерации"""
    
    product = db.query(PendingProductModel)\
        .filter(
            PendingProductModel.id == product_id,
            PendingProductModel.organization_id == current_user.organization_id
        )\
        .first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена"
        )
    
    # Преобразуем JSON строки обратно в списки
    product_dict = product.__dict__.copy()
    if product_dict.get('photos'):
        try:
            product_dict['photos'] = json.loads(product_dict['photos'])
        except:
            product_dict['photos'] = []
    else:
        product_dict['photos'] = []
    
    if product_dict.get('videos'):
        try:
            product_dict['videos'] = json.loads(product_dict['videos'])
        except:
            product_dict['videos'] = []
    else:
        product_dict['videos'] = []
        
    if product_dict.get('vehicle_ids'):
        try:
            product_dict['vehicle_ids'] = json.loads(product_dict['vehicle_ids'])
        except:
            product_dict['vehicle_ids'] = []
    else:
        product_dict['vehicle_ids'] = []
        
    # Удаляем SQLAlchemy состояние
    product_dict.pop('_sa_instance_state', None)
    
    return product_dict


@router.put("/{product_id}", response_model=PendingProduct)
def update_pending_product(
    product_id: int,
    product_data: PendingProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить запчасть в ожидании модерации"""
    
    product = db.query(PendingProductModel)\
        .filter(
            PendingProductModel.id == product_id,
            PendingProductModel.organization_id == current_user.organization_id
        )\
        .first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена"
        )
    
    # Обновляем поля
    update_data = product_data.dict(exclude_unset=True)
    
    # Преобразуем списки в JSON строки если они были изменены
    if 'photos' in update_data:
        update_data['photos'] = json.dumps(update_data['photos']) if update_data['photos'] else None
    if 'videos' in update_data:
        update_data['videos'] = json.dumps(update_data['videos']) if update_data['videos'] else None
    if 'vehicle_ids' in update_data:
        update_data['vehicle_ids'] = json.dumps(update_data['vehicle_ids']) if update_data['vehicle_ids'] else None
    
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    # Преобразуем JSON строки обратно в списки для ответа
    product_dict = product.__dict__.copy()
    if product_dict.get('photos'):
        try:
            product_dict['photos'] = json.loads(product_dict['photos'])
        except:
            product_dict['photos'] = []
    else:
        product_dict['photos'] = []
        
    if product_dict.get('vehicle_ids'):
        try:
            product_dict['vehicle_ids'] = json.loads(product_dict['vehicle_ids'])
        except:
            product_dict['vehicle_ids'] = []
    else:
        product_dict['vehicle_ids'] = []
        
    # Удаляем SQLAlchemy состояние
    product_dict.pop('_sa_instance_state', None)
    
    return product_dict


@router.delete("/{product_id}")
def delete_pending_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить запчасть из ожидания модерации"""
    
    product = db.query(PendingProductModel)\
        .filter(
            PendingProductModel.id == product_id,
            PendingProductModel.organization_id == current_user.organization_id
        )\
        .first()
    
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена"
        )
    
    db.delete(product)
    db.commit()
    
    return {"message": "Запчасть успешно удалена"}