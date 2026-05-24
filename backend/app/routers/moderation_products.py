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
from app.schemas.pending_product import PendingProductCreate
from app.schemas.product import ProductCreate
from app.core.auth import get_current_admin_user, get_current_user
from app.services.audit_service import log_audit
from app.services.yandex_feed_sync_service import mark_yandex_feed_dirty_for_used_product


router = APIRouter(prefix="/moderation/products", tags=["Moderation Products"])


def _safe_json_list(raw):
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    if not isinstance(raw, str):
        return []
    raw = raw.strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _normalize_media_urls(items):
    urls = []
    for item in items or []:
        if isinstance(item, str) and item.strip():
            urls.append(item.strip())
        elif isinstance(item, dict):
            url = (
                item.get("full_url")
                or item.get("photo_url")
                or item.get("video_url")
                or item.get("url")
                or item.get("path")
            )
            if url:
                urls.append(url)
    return urls


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
    product_dict["photos"] = _normalize_media_urls(_safe_json_list(product_dict.get("photos")))
    product_dict["videos"] = _normalize_media_urls(_safe_json_list(product_dict.get("videos")))
    product_dict["vehicle_ids"] = _safe_json_list(product_dict.get("vehicle_ids"))
    product_dict["storage_location_address"] = (
        product.storage_location.address if product.storage_location else None
    )
    product_dict["organization"] = _organization_payload(product.organization)
    product_dict["creator_name"] = getattr(product, "creator_name", None)
    product_dict.pop("_sa_instance_state", None)
    return product_dict


def _get_org_rejected_product(db: Session, product_id: int, user: User):
    if not user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не привязан к организации",
        )
    product = db.query(RejectedProductModel).filter(
        RejectedProductModel.id == product_id,
        RejectedProductModel.organization_id == user.organization_id,
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена",
        )
    return product


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
    """Отклонённые запчасти всей организации (для раздела «На модерации» у сотрудников)."""
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не привязан к организации",
        )

    products = (
        db.query(RejectedProductModel)
        .filter(RejectedProductModel.organization_id == current_user.organization_id)
        .order_by(RejectedProductModel.rejected_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    result = [_serialize_moderation_product(product) for product in products]

    return jsonable_encoder(result)


@router.get("/rejected/my/{product_id}", response_model=dict)
def get_my_rejected_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить одну отклонённую запчасть текущего пользователя"""
    product = _get_org_rejected_product(db, product_id, current_user)
    return jsonable_encoder(_serialize_moderation_product(product))


@router.delete("/rejected/my/{product_id}")
def delete_my_rejected_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удалить отклонённую запчасть организации"""
    product = _get_org_rejected_product(db, product_id, current_user)
    product_name = product.name or product.article
    org_id = product.organization_id
    db.delete(product)
    db.commit()
    log_audit(
        db,
        event_type="rejected_product_deleted",
        category="products",
        summary=f"Отклонённая запчасть удалена: {product_name or product_id}",
        user=current_user,
        organization_id=org_id,
        details={"rejected_product_id": product_id},
        entity_type="rejected_product",
        entity_id=product_id,
    )
    return {"message": "Запчасть успешно удалена"}


@router.post("/rejected/my/{product_id}/resubmit", response_model=dict)
def resubmit_rejected_product(
    product_id: int,
    product_data: PendingProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Повторно отправить отклонённую запчасть на модерацию"""
    rejected = _get_org_rejected_product(db, product_id, current_user)

    if not product_data.part_type_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Выберите вид запчасти",
        )

    photos_json = json.dumps(product_data.photos) if product_data.photos else None
    videos_json = json.dumps(product_data.videos) if product_data.videos else None
    vehicle_ids_json = json.dumps(product_data.vehicle_ids) if product_data.vehicle_ids else None

    db_pending = PendingProductModel(
        article=product_data.article,
        name=product_data.name,
        brand=product_data.brand,
        description=product_data.description,
        is_new=product_data.is_new,
        price=product_data.price,
        quantity=product_data.quantity,
        storage_location_id=product_data.storage_location_id,
        part_type_id=product_data.part_type_id,
        photos=photos_json,
        videos=videos_json,
        vehicle_ids=vehicle_ids_json,
        internal_code=rejected.internal_code,
        organization_id=rejected.organization_id or current_user.organization_id,
        created_by=current_user.id,
    )

    db.add(db_pending)
    db.delete(rejected)
    db.commit()
    db.refresh(db_pending)

    log_audit(
        db,
        event_type="product_resubmitted_to_moderation",
        category="products",
        summary=f"Запчасть повторно отправлена на модерацию: {db_pending.name or db_pending.article or db_pending.id}",
        user=current_user,
        organization_id=db_pending.organization_id,
        details={"rejected_product_id": product_id, "pending_product_id": db_pending.id},
        entity_type="pending_product",
        entity_id=db_pending.id,
    )

    return jsonable_encoder(_serialize_moderation_product(db_pending))


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
    
    approved_quantity = pending_product.quantity
    if approved_quantity is None or approved_quantity < 1:
        approved_quantity = 1

    # Создать запись в products (без vehicle_ids и photos)
    db_product = ProductModel(
        article=pending_product.article,
        name=pending_product.name,
        brand=pending_product.brand,
        internal_code=internal_code,
        description=pending_product.description,
        is_new=pending_product.is_new,
        price=pending_product.price,
        quantity=approved_quantity,
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
        quantity=approved_quantity,
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
    log_audit(
        db,
        event_type="product_moderation_approved",
        category="moderation",
        summary=f"Товар одобрен модерацией #{db_product.id}",
        user=current_user,
        organization_id=db_product.organization_id,
        entity_type="product",
        entity_id=db_product.id,
    )
    mark_yandex_feed_dirty_for_used_product(db, db_product, "product_moderation_approved")
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
    
    rejection_reason = (moderation_data.rejection_reason or '').strip()

    # Найти запчасть в pending
    pending_product = db.query(PendingProductModel)\
        .filter(PendingProductModel.id == product_id)\
        .first()
    
    if not pending_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Запчасть не найдена"
        )
    
    db_rejected = RejectedProductModel(
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
        part_type_id=pending_product.part_type_id,
        created_by=pending_product.created_by,
        rejection_reason=rejection_reason,
        photos=pending_product.photos,
        videos=pending_product.videos,
        vehicle_ids=pending_product.vehicle_ids,
    )
    db.add(db_rejected)
    pending_org_id = pending_product.organization_id

    # Удалить из pending
    db.delete(pending_product)

    db.commit()
    db.refresh(db_rejected)
    log_audit(
        db,
        event_type="product_moderation_rejected",
        category="moderation",
        summary=f"Товар отклонён модерацией (pending #{product_id})",
        user=current_user,
        organization_id=pending_org_id,
        details={"pending_product_id": product_id, "reason": rejection_reason or None},
    )
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