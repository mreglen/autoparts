from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
import json

from app.db.database import get_db
from app.models.pending_product import PendingProduct as PendingProductModel
from app.models.rejected_product import RejectedProduct as RejectedProductModel
from app.models.product import Product as ProductModel, ProductPhoto, ProductVideo
from app.models.vehicle import Vehicle as VehicleModel
from app.models.product_vehicle import ProductVehicleAssociation
from app.models.stock_in import StockIn as StockInModel
from app.models.user import User

from app.models.part_type import PartType as PartTypeModel
from app.models.product_storage_cell import ProductStorageCell
from app.models.pending_product_storage_cell import PendingProductStorageCell
from app.schemas.moderation import ModerateProductRequest, ModerateProductResponse
from app.schemas.rejected_product import RejectedProductCreate
from app.schemas.product import ProductCreate
from app.core.auth import get_current_admin_user, get_current_user


router = APIRouter(prefix="/moderation/products", tags=["Moderation Products"])


def _safe_json_list(raw):
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _organization_payload(organization):
    if not organization:
        return None
    return {
        "id": organization.id,
        "name": organization.name,
        "phone": organization.phone,
        "logo_organization": organization.logo_organization,
    }


def _serialize_moderation_product(product):
    product_dict = product.__dict__.copy()
    product_dict["photos"] = _safe_json_list(product_dict.get("photos"))
    product_dict["videos"] = _safe_json_list(product_dict.get("videos"))
    product_dict["vehicle_ids"] = _safe_json_list(product_dict.get("vehicle_ids"))
    product_dict["storage_location_address"] = (
        product.storage_location.address if product.storage_location else None
    )
    product_dict["organization"] = _organization_payload(product.organization)
    product_dict.pop("_sa_instance_state", None)
    return product_dict


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
    
    result = [_serialize_moderation_product(product) for product in products]

    return jsonable_encoder(result)


@router.get("/rejected/my", response_model=list)
def get_my_rejected_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить список отклоненных запчастей, созданных текущим пользователем"""
    
    products = db.query(RejectedProductModel)\
        .filter(RejectedProductModel.created_by == current_user.id)\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    
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
            

        product_dict.pop('_sa_instance_state', None)
        result.append(product_dict)

    return jsonable_encoder(result)


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

    if pending_product.part_type_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="У заявки не указан тип запчасти. Уточните у продавца или отклоните заявку.",
        )
    part_type = (
        db.query(PartTypeModel)
        .filter(PartTypeModel.id == pending_product.part_type_id)
        .first()
    )
    if not part_type:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Тип запчасти из заявки отсутствует в справочнике.",
        )
    
    # Генерируем последовательный числовой внутренний код для продуктов
    # Находим все существующие internal_code в products
    existing_codes_result = db.query(ProductModel.internal_code).all()
    
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
        created_by=pending_product.created_by,
        part_type_id=pending_product.part_type_id,
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
                    photo_url=photo_url,
                    organization_id=pending_product.organization_id,
                    processing_status='completed'
                )
                db.add(photo)
        except Exception as e:
            print(f"Error processing photos: {e}")
    
    # Обработка videos - создаем ProductVideo записи
    if pending_product.videos:
        try:
            videos_list = json.loads(pending_product.videos)
            for video_url in videos_list:
                video = ProductVideo(
                    product_id=db_product.id,
                    video_url=video_url,
                    organization_id=pending_product.organization_id,
                    processing_status='completed'
                )
                db.add(video)
        except Exception as e:
            print(f"Error processing videos: {e}")
    
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
        acquired_product_id=None, 
        created_by=pending_product.created_by
    )
    db.add(stock_in)
    
    # Переносим данные адресного хранения из pending в основную таблицу
    pending_storage_cells = db.query(PendingProductStorageCell).filter(
        PendingProductStorageCell.pending_product_id == pending_product.id
    ).all()
    
    for pending_cell in pending_storage_cells:
        product_storage_cell = ProductStorageCell(
            product_id=db_product.id,
            storage_cell_id=pending_cell.storage_cell_id,
            value=pending_cell.value
        )
        db.add(product_storage_cell)
    
    # Сохраняем изменения
    db.commit()
    
    # Удалить из pending (включая pending storage cells из-за cascade)
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
        videos=json.loads(pending_product.videos) if pending_product.videos else None,
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
    
    result = [_serialize_moderation_product(product) for product in products]

    return jsonable_encoder(result)