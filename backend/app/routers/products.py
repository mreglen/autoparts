import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models.product import ProductPhoto, ProductVideo, Product as ProductModel
from app.models.product_vehicle import ProductVehicleAssociation
from app.schemas.product import Product as ProductSchema, ProductCreate, ProductUpdate, ProductQuantityUpdate, Vehicle, DeletePhotosRequest, DeleteVideosRequest
from app.models.vehicle import Vehicle as VehicleModel
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from sqlalchemy.orm import selectinload


router = APIRouter(prefix="/products", tags=["Products"])



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

    # Автоматическая генерация internal_code, если не предоставлен
    if not product_data.get("internal_code"):
        # Находим все существующие internal_code для организации
        existing_codes_result = db.query(ProductModel.internal_code).filter(
            ProductModel.organization_id == current_user.organization_id
        ).all()

        # Извлекаем существующие коды как строки
        existing_codes = [code_tuple[0] for code_tuple in existing_codes_result]

        # Начинаем с 1 и находим следующий свободный код в формате 00001
        next_code = 1
        while True:
            candidate_code = f"{next_code:05d}"  # Формат 00001, 00002, etc.
            if candidate_code not in existing_codes:
                product_data["internal_code"] = candidate_code
                break
            next_code += 1

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
        selectinload(ProductModel.compatible_vehicles),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
    ).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")
    return product


@router.get("/public/{product_id}", response_model=ProductSchema)
def read_public_product(
    product_id: int,
    db: Session = Depends(get_db)
):
    product = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
    ).filter(
        ProductModel.id == product_id,
        ProductModel.quantity > 0  # Only show products that are in stock
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")
    return product

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
        selectinload(ProductModel.compatible_vehicles),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
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

    # Проверяем уникальность internal_code (если он изменился)
    if product.internal_code != db_product.internal_code:
        existing_product = db.query(ProductModel).filter(
            ProductModel.internal_code == product.internal_code,
            ProductModel.organization_id == current_user.organization_id,
            ProductModel.id != product_id  # Исключаем текущий продукт
        ).first()
        if existing_product:
            raise HTTPException(
                status_code=400,
                detail=f"Внутренний код '{product.internal_code}' уже используется другим продуктом"
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

    # Финальный commit (если не было видео или после обновления связей)
    if not product.videos and not photo_ids:
        db.commit()
    
    db.refresh(db_product)
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

    db.delete(db_product)
    db.commit()
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
        selectinload(ProductModel.compatible_vehicles),
        selectinload(ProductModel.creator),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
    ).filter(
        ProductModel.organization_id == current_user.organization_id,
        ProductModel.quantity > 0
    )
    
    # Фильтрация по складу, если указан
    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)
    
    products = query.all()
    return products


@router.get("/public/", response_model=list[ProductSchema])
def get_public_products(
    storage_location_id: int = None,
    db: Session = Depends(get_db)
):
    # Базовый запрос - получить все товары, которые есть в наличии
    query = db.query(ProductModel).options(
        selectinload(ProductModel.photos),
        selectinload(ProductModel.videos),
        selectinload(ProductModel.compatible_vehicles),
        selectinload(ProductModel.storage_location),
        selectinload(ProductModel.organization)
    ).filter(
        ProductModel.quantity > 0  # Только товары, которые есть в наличии
    )
    
    # Фильтрация по складу, если указан
    if storage_location_id is not None:
        query = query.filter(ProductModel.storage_location_id == storage_location_id)
    
    products = query.all()
    return products
