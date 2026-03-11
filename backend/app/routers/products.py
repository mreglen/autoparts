import os
from fastapi import APIRouter, Depends, HTTPException, status
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
    current_user: User = Depends(get_current_user)
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
    if product.photos:
        for url in product.photos:
            photo = ProductPhoto(
                product_id=db_product.id, 
                photo_url=url,
                organization_id=current_user.organization_id,
                processing_status='completed'
            )
            db.add(photo)
    
    # Сохраняем видео
    if product.videos:
        for url in product.videos:
            video = ProductVideo(
                product_id=db_product.id, 
                video_url=url,
                organization_id=current_user.organization_id,
                processing_status='completed'
            )
            db.add(video)
    db.commit()

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
    product: ProductUpdate,  # Changed from ProductCreate to ProductUpdate
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    if product.photos is not None:
        # Удаляем все предыдущие фото
        db.query(ProductPhoto).filter(ProductPhoto.product_id == product_id).delete()
        # Добавляем новые
        for url in product.photos:
            photo = ProductPhoto(product_id=product_id, photo_url=url)
            db.add(photo)
    
    # Обновляем видео: удаляем старые, добавляем новые
    if product.videos is not None:
        # Удаляем все предыдущие видео
        db.query(ProductVideo).filter(ProductVideo.product_id == product_id).delete()
        # Добавляем новые
        for url in product.videos:
            video = ProductVideo(product_id=product_id, video_url=url)
            db.add(video)

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

    # Delete photo records from database
    # (No local file deletion needed - files remain in storage)

    # Удаляем запись из базы данных
    db.delete(photo)
    db.commit()

    return

@router.delete("/{product_id}/photos", status_code=204)
def delete_product_photos(
    product_id: int,
    request: DeletePhotosRequest,
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

    # Skipping local file deletion as we're using S3 storage
    for photo in photos:
        # Old local file deletion code removed
        pass

        # Удаляем запись из базы данных
        db.delete(photo)

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

    # Удаляем запись из базы данных
    db.delete(video)
    db.commit()

    return


@router.delete("/{product_id}/videos", status_code=204)
def delete_product_videos(
    product_id: int,
    request: DeleteVideosRequest,
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

    # Удаляем записи из базы данных
    for video in videos:
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
