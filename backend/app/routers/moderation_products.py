from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import json

from app.db.database import get_db
from app.models.pending_product import PendingProduct as PendingProductModel
from app.models.rejected_product import RejectedProduct as RejectedProductModel
from app.models.product import Product as ProductModel, ProductPhoto
from app.models.vehicle import Vehicle as VehicleModel
from app.models.product_vehicle import ProductVehicleAssociation
from app.models.stock_in import StockIn as StockInModel
from app.models.user import User
from app.schemas.moderation import ModerateProductRequest, ModerateProductResponse
from app.schemas.rejected_product import RejectedProductCreate
from app.schemas.product import ProductCreate
from app.core.auth import get_current_admin_user
from app.utils.id_generator import generate_internal_code

router = APIRouter(prefix="/moderation/products", tags=["Moderation Products"])


@router.get("/pending", response_model=list)
def get_pending_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Получить список всех запчастей в ожидании модерации"""
    
    products = db.query(PendingProductModel)\
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


@router.post("/{product_id}/approve", response_model=ModerateProductResponse)
def approve_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Одобрить запчасть - перенести из pending в products"""
    
    # Найти запчасть в pending
    pending_product = db.query(PendingProductModel)\
        .filter(PendingProductModel.id == product_id)\
        .first()
    
    if not pending_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена"
        )
    
    # Проверить, что internal_code уникален
    internal_code = pending_product.internal_code
    while db.query(ProductModel).filter(ProductModel.internal_code == internal_code).first():
        internal_code = generate_internal_code()
    
    # Создать запись в products (без vehicle_ids и photos)
    db_product = ProductModel(
        article=pending_product.article,
        name=pending_product.name,
        brand=pending_product.brand,
        internal_code=internal_code,
        description=pending_product.description,
        is_new=pending_product.is_new,
        price=pending_product.price,
        quantity=pending_product.quantity,
        organization_id=pending_product.organization_id,
        storage_location_id=pending_product.storage_location_id,
        created_by=pending_product.created_by
    )
    
    db.add(db_product)
    
    # Сохраняем изменения, чтобы получить ID продукта
    db.commit()
    db.refresh(db_product)
    
    # Обработка photos - создаем ProductPhoto записи
    if pending_product.photos:
        try:
            photos_list = json.loads(pending_product.photos)
            for photo_url in photos_list:
                photo = ProductPhoto(
                    product_id=db_product.id,
                    photo_url=photo_url
                )
                db.add(photo)
        except Exception as e:
            print(f"Error processing photos: {e}")
    
    # Обработка vehicle_ids - создаем связи с автомобилями
    if pending_product.vehicle_ids:
        try:
            vehicle_ids_list = json.loads(pending_product.vehicle_ids)
            for vehicle_id in vehicle_ids_list:
                # Проверяем, что автомобиль существует
                vehicle = db.query(VehicleModel).filter(VehicleModel.id == vehicle_id).first()
                if vehicle:
                    # Создаем связь через промежуточную таблицу
                    product_vehicle_assoc = db.query(ProductVehicleAssociation).filter(
                        ProductVehicleAssociation.product_id == db_product.id,
                        ProductVehicleAssociation.vehicle_id == vehicle_id
                    ).first()
                    
                    if not product_vehicle_assoc:
                        assoc = ProductVehicleAssociation(
                            product_id=db_product.id,
                            vehicle_id=vehicle_id
                        )
                        db.add(assoc)
        except Exception as e:
            print(f"Error processing vehicle_ids: {e}")
    
    # Создаем запись в поступлениях (stock_in)
    # Для этого создаем запись в stock_in напрямую без связанного acquired_product
    stock_in = StockInModel(
        quantity=pending_product.quantity,
        sale_price=pending_product.price,
        organization_id=pending_product.organization_id,
        storage_location_id=pending_product.storage_location_id,
        product_id=db_product.id,
        acquired_product_id=None,  # Не создаем связанную запись в acquired_products
        created_by=pending_product.created_by
    )
    db.add(stock_in)
    
    # Сохраняем изменения
    db.commit()
    
    # Удалить из pending
    db.delete(pending_product)
    
    db.commit()
    db.refresh(db_product)
    
    return ModerateProductResponse(
        message="Запчасть одобрена и добавлена в каталог",
        product_id=db_product.id
    )


@router.post("/{product_id}/reject", response_model=ModerateProductResponse)
def reject_product(
    product_id: int,
    moderation_data: ModerateProductRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Отклонить запчасть - перенести в rejected_products"""
    
    if not moderation_data.rejection_reason or not moderation_data.rejection_reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо указать причину отклонения"
        )
    
    # Найти запчасть в pending
    pending_product = db.query(PendingProductModel)\
        .filter(PendingProductModel.id == product_id)\
        .first()
    
    if not pending_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена"
        )
    
    # Создать запись в rejected_products
    rejected_data = RejectedProductCreate(
        article=pending_product.article,
        name=pending_product.name,
        brand=pending_product.brand,
        internal_code=pending_product.internal_code,
        description=pending_product.description,
        is_new=pending_product.is_new,
        price=pending_product.price,
        quantity=pending_product.quantity,
        organization_id=pending_product.organization_id,
        storage_location_id=pending_product.storage_location_id,
        created_by=pending_product.created_by,
        rejection_reason=moderation_data.rejection_reason.strip(),
        photos=json.loads(pending_product.photos) if pending_product.photos else None,
        vehicle_ids=json.loads(pending_product.vehicle_ids) if pending_product.vehicle_ids else None
    )
    
    db_rejected = RejectedProductModel(**rejected_data.dict())
    db.add(db_rejected)
    
    # Удалить из pending
    db.delete(pending_product)
    
    db.commit()
    db.refresh(db_rejected)
    
    return ModerateProductResponse(
        message="Запчасть отклонена",
        product_id=db_rejected.id
    )


@router.get("/rejected", response_model=list)
def get_rejected_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Получить список отклоненных запчастей"""
    
    products = db.query(RejectedProductModel)\
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