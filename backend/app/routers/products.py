import os
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.models.product import ProductPhoto, ProductVideo, Product as ProductModel
from app.models.product_storage_cell import ProductStorageCell as ProductStorageCellModel
from app.models.product_vehicle import ProductVehicleAssociation
from app.schemas.product import (
    Product as ProductSchema,
    ProductCreate,
    ProductUpdate,
    ProductQuantityUpdate,
    DeletePhotosRequest,
    DeleteVideosRequest,
    QrPartCardResponse,
)
from app.schemas.vehicle import Vehicle as VehicleSchema
from app.models.vehicle import Vehicle as VehicleModel
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.yandex_feed_sync_service import (
    mark_yandex_feed_dirty,
    mark_yandex_feed_dirty_for_used_product,
)
from sqlalchemy.orm import selectinload
from app.routers.search_products import normalize_partnumber, get_sql_normalize
from app.core.config import settings
from app.utils.json_cache_sync import get_cached_json_sync, set_cached_json_sync
from app.utils.internal_code import is_valid_internal_code, next_internal_code


router = APIRouter(prefix="/products", tags=["Products"])


class PublicProductsResponse(BaseModel):
    items: List[ProductSchema]
    total: int
    page: int
    page_size: int


def _public_list_load_options():
    return [
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.compatible_vehicles),
    ]


class AiDescriptionAccessOut(BaseModel):
    show_ui: bool = False
    enabled: bool
    reason: str | None = None
    remaining_today: int
    org_limit: int
    global_limit: int
    global_used: int
    org_used: int


class GenerateDescriptionIn(BaseModel):
    brand: str
    article: str
    name: str
    is_new: bool = False
    part_type_id: int | None = None
    product_id: int | None = None
    existing_description: str | None = Field(None, max_length=2000)


class GenerateDescriptionOut(BaseModel):
    description: str
    tokens_used: int | None = None


@router.get("/ai-description/access", response_model=AiDescriptionAccessOut)
def get_ai_description_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.ai_description_service import get_seller_access_info

    return get_seller_access_info(db, current_user)


@router.post("/generate-description", response_model=GenerateDescriptionOut)
def generate_product_description_endpoint(
    payload: GenerateDescriptionIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.ai_description_service import generate_product_description

    result = generate_product_description(
        db,
        user=current_user,
        brand=payload.brand,
        article=payload.article,
        name=payload.name,
        is_new=payload.is_new,
        part_type_id=payload.part_type_id,
        product_id=payload.product_id,
        existing_description=payload.existing_description,
    )
    return GenerateDescriptionOut(**result)


class PublicUsedProductMatchOut(BaseModel):
    id: int
    brand: str | None = None
    article: str | None = None
    name: str | None = None
    price: float | None = None
    quantity: int = 0
    photo_url: str | None = None
    organization_name: str | None = None
    organization_address: str | None = None
    city: str | None = None
    compatible_vehicles: list[VehicleSchema] = []



@router.post("/", response_model=ProductSchema)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None  # Добавляем Request
):
    if not current_user.is_seller or not current_user.organization_id:
        raise HTTPException(
            status_code=403,
            detail="Только продавцы могут добавлять товары"
        )

    # Подготавливаем данные продукта
    product_data = product.dict(exclude={"vehicle_ids", "photos", "videos"})

    if not product_data.get("internal_code"):
        product_data["internal_code"] = next_internal_code(db, current_user.organization_id)
    elif not is_valid_internal_code(product_data["internal_code"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный формат внутреннего кода (ожидается XXXX-AAAAA)",
        )

    # Создаём продукт
    db_product = ProductModel(
        **product_data,
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    # Сохраняем фото
    photo_ids = []
    if product.photos:
        for url in product.photos:
            photo = ProductPhoto(
                product_id=db_product.id, 
                photo_url=url,
                organization_id=current_user.organization_id,
                processing_status='pending'  # Сначала pending - обработка начнется позже
            )
            db.add(photo)
            db.flush()  # Чтобы получить ID
            photo_ids.append(photo.id)
    
    # Сохраняем видео
    video_ids = []
    if product.videos:
        for url in product.videos:
            video = ProductVideo(
                product_id=db_product.id, 
                video_url=url,
                organization_id=current_user.organization_id,
                processing_status='pending'  # Сначала pending - обработка начнется позже
            )
            db.add(video)
            db.flush()  # Чтобы получить ID
            video_ids.append(video.id)
        
        # 🚀 ВАЖНО: Делаем commit ДО вызова endpoint!
        # Иначе endpoint не увидит запись в БД
        db.commit()
        print(f"✅ Video records committed to database: {video_ids}")
    else:
        db.commit()
    
    # 🚀 НОВАЯ ЛОГИКА: Запускаем обработку видео только после создания продукта
    # Видео попадает в очередь Celery и ждет обработки
    if video_ids:
        try:
            import requests
            from app.core.config import settings
            base_url = settings.BASE_URL.rstrip('/')
            
            # 🔒 Получаем токен из заголовка запроса для внутренних вызовов
            from fastapi import Request
            token = None
            if request and hasattr(request, 'headers'):
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            for video_id in video_ids:
                # Отправляем запрос на постановку в очередь обработки
                # Задача НЕ начинается сразу, а ждет в очереди Celery
                try:
                    headers = {'Authorization': f'Bearer {token}'} if token else {}
                    response = requests.post(
                        f"{base_url}/api/upload/start-video-processing/{video_id}",
                        headers=headers,
                        timeout=5  # Не ждем ответа долго
                    )
                    print(f"✅ Video {video_id} added to Celery queue (waiting for processing): {response.status_code}")
                    print(f"Response: {response.json()}")
                except Exception as e:
                    print(f"⚠️ Warning: Could not add video to processing queue: {e}")
                    # Это не критично - фронтенд может запустить сам
        except Exception as e:
            print(f"⚠️ Warning: Error adding videos to queue: {e}")
            # Не прерываем создание продукта из-за этого
    
    # 🚀 НОВАЯ ЛОГИКА: Запускаем обработку фото после создания продукта
    # Фото попадает в очередь Celery и ждет обработки
    if photo_ids:
        try:
            import requests
            from app.core.config import settings
            base_url = settings.BASE_URL.rstrip('/')
            
            # 🔒 Получаем токен из заголовка запроса для внутренних вызовов
            from fastapi import Request
            token = None
            if request and hasattr(request, 'headers'):
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            for photo_id in photo_ids:
                # Отправляем запрос на постановку в очередь обработки
                try:
                    headers = {'Authorization': f'Bearer {token}'} if token else {}
                    response = requests.post(
                        f"{base_url}/api/upload/start-photo-processing/{photo_id}",
                        headers=headers,
                        timeout=5  # Не ждем ответа долго
                    )
                    print(f"✅ Photo {photo_id} added to Celery queue (waiting for processing): {response.status_code}")
                    print(f"Response: {response.json()}")
                except Exception as e:
                    print(f"⚠️ Warning: Could not add photo to processing queue: {e}")
                    # Это не критично - фронтенд может запустить сам
        except Exception as e:
            print(f"⚠️ Warning: Error adding photos to queue: {e}")
            # Не прерываем создание продукта из-за этого

    # Связываем с автомобилями
    if product.vehicle_ids:
        vehicles = db.query(VehicleModel).filter(
            VehicleModel.id.in_(product.vehicle_ids),
            VehicleModel.organization_id == current_user.organization_id
        ).all()
        if len(vehicles) != len(product.vehicle_ids):
            raise HTTPException(400, "Некоторые автомобили не найдены или недоступны")

        for vehicle in vehicles:
            association = ProductVehicleAssociation(
                product_id=db_product.id,
                vehicle_id=vehicle.id
            )
            db.add(association)
        db.commit()

    db.refresh(db_product)
    log_audit(
        db,
        event_type="product_created",
        category="products",
        summary=f"Создан товар #{db_product.id}: {db_product.name}",
        user=current_user,
        organization_id=current_user.organization_id,
        entity_type="product",
        entity_id=db_product.id,
    )
    if db_product.is_new is False:
        mark_yandex_feed_dirty(db, "product_created_used")
    return db_product

@router.get("/{product_id}", response_model=ProductSchema)
def read_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles).options(
            selectinload(VehicleModel.vin_row),
            selectinload(VehicleModel.mileage_row),
        ),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.part_type)
    ).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")
    return product


@router.get("/public/find-used-match", response_model=list[PublicUsedProductMatchOut])
def find_public_used_product_match(
    brand: str = Query(..., min_length=1, max_length=120),
    article: str = Query(..., min_length=1, max_length=120),
    limit: int = Query(10, ge=1, le=50),
    exclude_product_id: int | None = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    brand_text = str(brand or "").strip()
    article_text = str(article or "").strip()
    if not brand_text or not article_text:
        return []

    from app.utils.organization_city import extract_city_from_address

    load_options = (
        selectinload(ProductModel.photos),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.compatible_vehicles),
    )

    exact_query = (
        db.query(ProductModel)
        .options(*load_options)
        .filter(
            ProductModel.quantity > 0,
            ProductModel.is_new.is_(False),
            ProductModel.brand.ilike(brand_text),
            ProductModel.article.ilike(article_text),
        )
        .order_by(ProductModel.id.desc())
    )
    products = exact_query.limit(limit).all()
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
                    get_sql_normalize(ProductModel.article) == normalized_article,
                )
                .order_by(ProductModel.id.desc())
                .limit(limit)
                .all()
            )
    if not products:
        return []

    def _photo_url(product: ProductModel) -> str | None:
        for photo in product.photos or []:
            url = str(getattr(photo, "photo_url", "") or "").strip()
            if url:
                return url
        return None

    results: list[PublicUsedProductMatchOut] = []
    for product in products:
        if exclude_product_id is not None and int(product.id) == int(exclude_product_id):
            continue
        org = getattr(product, "organization", None)
        org_address = getattr(org, "address", None) if org else None
        org_name = getattr(org, "name", None) if org else None
        city = extract_city_from_address(str(org_address) if org_address else None)
        results.append(
            PublicUsedProductMatchOut(
                id=product.id,
                brand=product.brand,
                article=product.article,
                name=product.name,
                price=float(product.price) if product.price is not None else None,
                quantity=int(product.quantity or 0),
                photo_url=_photo_url(product),
                organization_name=str(org_name).strip() if org_name else None,
                organization_address=str(org_address).strip() if org_address else None,
                city=city,
                compatible_vehicles=list(product.compatible_vehicles or []),
            )
        )
    return results


@router.get("/public/{product_id}", response_model=ProductSchema)
def read_public_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles).options(
            selectinload(VehicleModel.vin_row),
            selectinload(VehicleModel.mileage_row),
        ),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.part_type),
    ).filter(
        ProductModel.id == product_id,
        ProductModel.quantity > 0  # Only show products that are in stock
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")
    return product


@router.get("/qr-card/{product_id}", response_model=QrPartCardResponse)
def read_qr_part_card(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Security requirement: always return 404 for any denied scenario.
    if not current_user or not current_user.is_seller or not current_user.organization_id:
        raise HTTPException(status_code=404, detail="Not found")

    product = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.product_storage_cells).selectinload(ProductStorageCellModel.storage_cell),
    ).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id,
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Not found")

    product_storage_cells_out = []
    storage_addresses = []
    for link in product.product_storage_cells or []:
        value = (link.value or "").strip()
        if not value:
            continue
        cell_name = link.storage_cell.name if link.storage_cell else None
        product_storage_cells_out.append(
            {
                "id": link.id,
                "storage_cell_id": link.storage_cell_id,
                "value": value,
                "storage_cell_name": cell_name,
            }
        )
        if cell_name:
            storage_addresses.append(f"{cell_name}: {value}")
        else:
            storage_addresses.append(value)

    return QrPartCardResponse(
        id=product.id,
        name=product.name,
        brand=product.brand,
        article=product.article,
        quantity=product.quantity,
        internal_code=product.internal_code,
        price=float(product.price) if product.price is not None else None,
        storage_location_name=(product.storage_location.address if product.storage_location else None),
        storage_addresses=storage_addresses,
        product_storage_cells=product_storage_cells_out,
        photos=product.photos or [],
        videos=product.videos or [],
    )

@router.put("/{product_id}", response_model=ProductSchema)
def update_product(
    product_id: int,
    product: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None  # 🔒 Добавляем Request для получения токена
):
    db_product = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles).options(
            selectinload(VehicleModel.vin_row),
            selectinload(VehicleModel.mileage_row),
        ),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.part_type)
    ).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")

    # Validate media limits
    if product.photos is not None:
        if len(product.photos) > 5:
            raise HTTPException(
                status_code=400,
                detail="Максимум 5 фотографий на запчасть"
            )
    
    if product.videos is not None:
        if len(product.videos) > 1:
            raise HTTPException(
                status_code=400,
                detail="Максимум 1 видео на запчасть"
            )

    if product.internal_code != db_product.internal_code:
        if product.internal_code and not is_valid_internal_code(product.internal_code):
            raise HTTPException(
                status_code=400,
                detail="Некорректный формат внутреннего кода (ожидается XXXX-AAAAA)",
            )
        existing_product = db.query(ProductModel).filter(
            ProductModel.internal_code == product.internal_code,
            ProductModel.id != product_id,
        ).first()
        if existing_product:
            raise HTTPException(
                status_code=400,
                detail=f"Внутренний код '{product.internal_code}' уже используется другим продуктом",
            )

    # Обновляем основные поля
    update_data = product.dict(exclude={"vehicle_ids", "photos", "videos"})

    # Исключаем internal_code, если он пустой или null
    if not update_data.get("internal_code"):
        del update_data["internal_code"]

    for key, value in update_data.items():
        setattr(db_product, key, value)

    # Обновляем фото: удаляем старые, добавляем новые
    photo_ids = []
    if product.photos is not None:
        # Удаляем все предыдущие фото
        db.query(ProductPhoto).filter(ProductPhoto.product_id == product_id).delete()
        # Добавляем новые
        for url in product.photos:
            photo = ProductPhoto(product_id=product_id, photo_url=url, organization_id=current_user.organization_id, processing_status='pending')
            db.add(photo)
            db.flush()  # Чтобы получить ID но не коммитить!
            photo_ids.append(photo.id)
        print(f"Created {len(photo_ids)} photo record(s) with IDs: {photo_ids}")
    
    # Обновляем видео: удаляем старые, добавляем новые
    video_ids = []
    if product.videos is not None:
        print(f"\n=== UPDATING VIDEOS FOR PRODUCT {product_id} ===")
        print(f"Received videos: {product.videos}")
        
        # Удаляем все предыдущие видео
        db.query(ProductVideo).filter(ProductVideo.product_id == product_id).delete()
        # Добавляем новые
        for url in product.videos:
            video = ProductVideo(product_id=product_id, video_url=url, organization_id=current_user.organization_id, processing_status='pending')
            db.add(video)
            db.flush()  # Чтобы получить ID но не коммитить!
            video_ids.append(video.id)
            print(f"Created video record ID {video.id} with URL: {url}")
    
    # 🚀 ВАЖНО: Делаем commit ПОСЛЕ добавления и фото, и видео!
    # Иначе endpoint не увидит записи в БД
    db.commit()
    print(f"✅ All records committed to database: {len(photo_ids)} photos, {len(video_ids)} videos")
    
    # 🚀 ЗАПУСКАЕМ ОБРАБОТКУ ВИДЕО после обновления
    if video_ids:
        print(f"\n🎬 Starting video processing for {len(video_ids)} video(s)...")
        try:
            import requests
            from app.core.config import settings
            base_url = settings.BASE_URL.rstrip('/')
            
            # 🔒 Получаем токен из заголовка запроса для внутренних вызовов
            token = None
            if request and hasattr(request, 'headers'):
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            for video_id in video_ids:
                try:
                    print(f"Calling: {base_url}/api/upload/start-video-processing/{video_id}")
                    headers = {'Authorization': f'Bearer {token}'} if token else {}
                    response = requests.post(
                        f"{base_url}/api/upload/start-video-processing/{video_id}",
                        headers=headers,
                        timeout=10  # Увеличенный таймаут
                    )
                    print(f"✅ Started processing for updated video {video_id}: Status {response.status_code}")
                    print(f"Response: {response.json()}")
                except Exception as e:
                    print(f"⚠️ Warning: Could not start video processing for video {video_id}: {e}")
                    import traceback
                    print(f"Full error: {traceback.format_exc()}")
        except Exception as e:
            print(f"⚠️ Warning: Error starting video processing: {e}")
            import traceback
            print(f"Full error: {traceback.format_exc()}")
    else:
        print("ℹ️ No videos to process")
    
    # 🚀 НОВАЯ ЛОГИКА: Запускаем обработку фото после обновления продукта
    if photo_ids:
        print(f"\n📸 Starting photo processing for {len(photo_ids)} photo(s)...")
        try:
            import requests
            from app.core.config import settings
            base_url = settings.BASE_URL.rstrip('/')
            
            # 🔒 Получаем токен из заголовка запроса для внутренних вызовов
            token = None
            if request and hasattr(request, 'headers'):
                auth_header = request.headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]  # Remove 'Bearer ' prefix
            
            for photo_id in photo_ids:
                try:
                    print(f"Calling: {base_url}/api/upload/start-photo-processing/{photo_id}")
                    headers = {'Authorization': f'Bearer {token}'} if token else {}
                    response = requests.post(
                        f"{base_url}/api/upload/start-photo-processing/{photo_id}",
                        headers=headers,
                        timeout=10  # Увеличенный таймаут
                    )
                    print(f"✅ Started processing for updated photo {photo_id}: Status {response.status_code}")
                    print(f"Response: {response.json()}")
                except Exception as e:
                    print(f"⚠️ Warning: Could not start photo processing for photo {photo_id}: {e}")
                    import traceback
                    print(f"Full error: {traceback.format_exc()}")
        except Exception as e:
            print(f"⚠️ Warning: Error starting photo processing: {e}")
            import traceback
            print(f"Full error: {traceback.format_exc()}")
    else:
        print("ℹ️ No photos to process")

    # Обновляем связи с автомобилями
    if product.vehicle_ids is not None:
        # Удаляем существующие связи
        db.query(ProductVehicleAssociation).filter(ProductVehicleAssociation.product_id == product_id).delete()
        # Добавляем новые связи
        if product.vehicle_ids:
            vehicles = db.query(VehicleModel).filter(
                VehicleModel.id.in_(product.vehicle_ids),
                VehicleModel.organization_id == current_user.organization_id
            ).all()
            if len(vehicles) != len(product.vehicle_ids):
                raise HTTPException(400, "Некоторые автомобили не найдены или недоступны")

            for vehicle in vehicles:
                association = ProductVehicleAssociation(
                    product_id=product_id,
                    vehicle_id=vehicle.id
                )
                db.add(association)

    # Финальный commit после возможного обновления связей с автомобилями
    db.commit()
    
    db.refresh(db_product)
    log_audit(
        db,
        event_type="product_updated",
        category="products",
        summary=f"Обновлён товар #{db_product.id}: {db_product.name}",
        user=current_user,
        organization_id=current_user.organization_id,
        entity_type="product",
        entity_id=db_product.id,
    )
    if db_product.is_new is False or ("is_new" in update_data):
        mark_yandex_feed_dirty(db, "product_updated")
    return db_product

@router.patch("/{product_id}/quantity", response_model=ProductSchema)
def update_product_quantity(
    product_id: int,
    quantity_update: ProductQuantityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")

    # Обновляем только количество
    db_product.quantity = quantity_update.quantity

    db.commit()
    db.refresh(db_product)
    log_audit(
        db,
        event_type="product_quantity_changed",
        category="products",
        summary=f"Количество товара #{db_product.id}: {quantity_update.quantity} шт.",
        user=current_user,
        organization_id=current_user.organization_id,
        details={"product_id": db_product.id, "quantity": quantity_update.quantity},
        entity_type="product",
        entity_id=db_product.id,
    )
    if db_product.is_new is False:
        mark_yandex_feed_dirty(db, "product_quantity_changed")
    return db_product

@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")

    product_name = db_product.name
    product_id_val = db_product.id
    db.delete(db_product)
    db.commit()
    if db_product.is_new is False:
        mark_yandex_feed_dirty(db, "product_deleted_used")
    log_audit(
        db,
        event_type="product_deleted",
        category="products",
        summary=f"Удалён товар #{product_id_val}: {product_name}",
        user=current_user,
        organization_id=current_user.organization_id,
        entity_type="product",
        entity_id=product_id_val,
    )
    return

# Bulk delete endpoints MUST come before single delete endpoints for proper routing
@router.delete("/{product_id}/photos", status_code=204)
def delete_product_photos(
    product_id: int,
    request: DeletePhotosRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print(f"DEBUG: Attempting to delete photos from product {product_id}")
    print(f"DEBUG: User organization: {current_user.organization_id}, is_seller: {current_user.is_seller}")
    print(f"DEBUG: Photo IDs to delete: {request.photo_ids}")
    
    # Проверяем, что продукт принадлежит организации пользователя
    product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        print(f"DEBUG: Product {product_id} not found or not accessible")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Продукт не найден или недоступен"
        )

    # Проверяем, что пользователь является продавцом
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только продавцы могут удалять фото товаров"
        )

    # Находим все фото для удаления
    photos = db.query(ProductPhoto).filter(
        ProductPhoto.id.in_(request.photo_ids),
        ProductPhoto.product_id == product_id
    ).all()

    if len(photos) != len(request.photo_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Некоторые фото не найдены"
        )

    # Удаляем физические файлы фото
    base_dir = Path(__file__).parent.parent.parent
    for photo in photos:
        try:
            # Build the file path from photo_url
            # photo_url is stored as /pictures/{org_id}/{filename}.webp
            # Physical file is at uploads/pictures/{org_id}/{filename}.webp
            photo_path = photo.photo_url
            
            # Remove leading slash if present
            if photo_path.startswith('/'):
                photo_path = photo_path[1:]
            
            # Build absolute path: base_dir/uploads/pictures/{org_id}/{filename}.webp
            abs_photo_path = base_dir / "uploads" / photo_path
            
            print(f"Attempting to delete photo file: {abs_photo_path}")
            print(f"Photo URL from DB: {photo.photo_url}")
            print(f"Constructed path: {abs_photo_path}")
            
            # Delete file if it exists
            if os.path.exists(abs_photo_path):
                os.remove(abs_photo_path)
                print(f"✓ Deleted photo file: {abs_photo_path}")
            else:
                print(f"⚠️ Photo file not found: {abs_photo_path}")
        except Exception as e:
            print(f"Error deleting photo file: {str(e)}")
            # Continue with DB deletion even if file deletion fails
        
        # Удаляем запись из базы данных
        db.delete(photo)

    db.commit()
    mark_yandex_feed_dirty_for_used_product(db, product, "product_photos_deleted")

    return

@router.delete("/{product_id}/photos/{photo_id}", status_code=204)
def delete_product_photo(
    product_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Проверяем, что продукт принадлежит организации пользователя
    product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Продукт не найден или недоступен"
        )

    # Проверяем, что пользователь является продавцом
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только продавцы могут удалять фото товаров"
        )

    # Находим фото
    photo = db.query(ProductPhoto).filter(
        ProductPhoto.id == photo_id,
        ProductPhoto.product_id == product_id
    ).first()
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Фото не найдено"
        )

    # Удаляем физический файл фото
    try:
        # Build the file path from photo_url
        # photo_url is stored as /pictures/{org_id}/{filename}.webp
        # Physical file is at uploads/pictures/{org_id}/{filename}.webp
        photo_path = photo.photo_url
        
        # Remove leading slash if present
        if photo_path.startswith('/'):
            photo_path = photo_path[1:]
        
        # Build absolute path: base_dir/uploads/pictures/{org_id}/{filename}.webp
        base_dir = Path(__file__).parent.parent.parent
        abs_photo_path = base_dir / "uploads" / photo_path
        
        print(f"Attempting to delete photo file: {abs_photo_path}")
        print(f"Photo URL from DB: {photo.photo_url}")
        print(f"Constructed path: {abs_photo_path}")
        
        # Delete file if it exists
        if os.path.exists(abs_photo_path):
            os.remove(abs_photo_path)
            print(f"✓ Deleted photo file: {abs_photo_path}")
        else:
            print(f"⚠️ Photo file not found: {abs_photo_path}")
    except Exception as e:
        print(f"Error deleting photo file: {str(e)}")
        # Continue with DB deletion even if file deletion fails

    # Удаляем запись из базы данных
    db.delete(photo)
    db.commit()
    mark_yandex_feed_dirty_for_used_product(db, product, "product_photo_deleted")

    return


# Bulk video delete MUST come before single video delete for proper routing
@router.delete("/{product_id}/videos", status_code=204)
def delete_product_videos(
    product_id: int,
    request: DeleteVideosRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print(f"DEBUG: Attempting to delete videos from product {product_id}")
    print(f"DEBUG: User organization: {current_user.organization_id}, is_seller: {current_user.is_seller}")
    print(f"DEBUG: Video IDs to delete: {request.video_ids}")
    
    # Проверяем, что продукт принадлежит организации пользователя
    product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        print(f"DEBUG: Product {product_id} not found or not accessible")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Продукт не найден или недоступен"
        )

    # Проверяем, что пользователь является продавцом
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только продавцы могут удалять видео товаров"
        )

    # Находим все видео для удаления
    videos = db.query(ProductVideo).filter(
        ProductVideo.id.in_(request.video_ids),
        ProductVideo.product_id == product_id
    ).all()

    if len(videos) != len(request.video_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Некоторые видео не найдены"
        )

    # Удаляем физические файлы видео
    base_dir = Path(__file__).parent.parent.parent
    for video in videos:
        try:
            # Build the file path from video_url
            # video_url is stored as /videos/{org_id}/{filename}.mp4
            # Physical file is at uploads/videos/{org_id}/{filename}.mp4
            video_path = video.video_url
            
            # Remove leading slash if present
            if video_path.startswith('/'):
                video_path = video_path[1:]
            
            # Build absolute path: base_dir/uploads/videos/{org_id}/{filename}.mp4
            abs_video_path = base_dir / "uploads" / video_path
            
            print(f"Attempting to delete video file: {abs_video_path}")
            print(f"Video URL from DB: {video.video_url}")
            print(f"Constructed path: {abs_video_path}")
            
            # Delete file if it exists
            if os.path.exists(abs_video_path):
                os.remove(abs_video_path)
                print(f"✓ Deleted video file: {abs_video_path}")
            else:
                print(f"⚠️ Video file not found: {abs_video_path}")
        except Exception as e:
            print(f"Error deleting video file: {str(e)}")
            # Continue with DB deletion even if file deletion fails
        
        # Удаляем запись из базы данных
        db.delete(video)

    db.commit()

    return


@router.delete("/{product_id}/videos/{video_id}", status_code=204)
def delete_product_video(
    product_id: int,
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Проверяем, что продукт принадлежит организации пользователя
    product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Продукт не найден или недоступен"
        )

    # Проверяем, что пользователь является продавцом
    if not current_user.is_seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только продавцы могут удалять видео товаров"
        )

    # Находим видео
    video = db.query(ProductVideo).filter(
        ProductVideo.id == video_id,
        ProductVideo.product_id == product_id
    ).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Видео не найдено"
        )

    # Удаляем физический файл видео
    try:
        # Build the file path from video_url
        # video_url is stored as /videos/{org_id}/{filename}.mp4
        # Physical file is at uploads/videos/{org_id}/{filename}.mp4
        video_path = video.video_url
        
        # Remove leading slash if present
        if video_path.startswith('/'):
            video_path = video_path[1:]
        
        # Build absolute path: base_dir/uploads/videos/{org_id}/{filename}.mp4
        base_dir = Path(__file__).parent.parent.parent
        abs_video_path = base_dir / "uploads" / video_path
        
        print(f"Attempting to delete video file: {abs_video_path}")
        print(f"Video URL from DB: {video.video_url}")
        print(f"Constructed path: {abs_video_path}")
        
        # Delete file if it exists
        if os.path.exists(abs_video_path):
            os.remove(abs_video_path)
            print(f"✓ Deleted video file: {abs_video_path}")
        else:
            print(f"⚠️ Video file not found: {abs_video_path}")
    except Exception as e:
        print(f"Error deleting video file: {str(e)}")
        # Continue with DB deletion even if file deletion fails

    # Удаляем запись из базы данных
    db.delete(video)
    db.commit()

    return


@router.get("/", response_model=list[ProductSchema])
def get_products(
    storage_location_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    
    # Базовый запрос
    query = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles).options(
            selectinload(VehicleModel.vin_row),
            selectinload(VehicleModel.mileage_row),
        ),
        selectinload(ProductModel.creator),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization),
        selectinload(ProductModel.avito_listing_links),  # Load Avito listing links
        selectinload(ProductModel.drom_listing_links)  # Load Drom listing links
    ).filter(
        ProductModel.organization_id == current_user.organization_id,
        ProductModel.quantity > 0
    )
    
    # Фильтрация по складу, если указан
    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)
    
    products = query.all()
    
    # Set is_on_avito and is_on_drom flags for each product
    for product in products:
        product.is_on_avito = len(product.avito_listing_links) > 0
        product.is_on_drom = len(product.drom_listing_links) > 0
    
    return products


@router.get("/public/", response_model=PublicProductsResponse)
def get_public_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    storage_location_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    loc_key = storage_location_id if storage_location_id is not None else "all"
    cache_key = f"products:public:p{page}:s{page_size}:loc:{loc_key}"
    cached = get_cached_json_sync(cache_key)
    if cached is not None:
        return cached

    query = db.query(ProductModel).options(
        *_public_list_load_options()
    ).filter(
        ProductModel.quantity > 0
    )

    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)

    total = query.order_by(None).count()
    products = (
        query.order_by(ProductModel.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    for product in products:
        product.is_on_avito = len(product.avito_listing_links) > 0
        product.is_on_drom = len(product.drom_listing_links) > 0

    response = PublicProductsResponse(
        items=products,
        total=total,
        page=page,
        page_size=page_size,
    )
    set_cached_json_sync(
        cache_key,
        response.model_dump(mode="json"),
        settings.PRODUCTS_PUBLIC_CACHE_TTL_SECONDS,
    )
    return response
