import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.models.product import ProductPhoto, Product as ProductModel
from app.models.product_vehicle import ProductVehicleAssociation
from app.schemas.product import Product as ProductSchema, ProductCreate, Vehicle, DeletePhotosRequest
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

    # Создаём продукт
    db_product = ProductModel(
        **product.dict(exclude={"vehicle_ids", "photos"}),
        organization_id=current_user.organization_id,
        created_by=current_user.id
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)

    # Сохраняем фото
    if product.photos:
        for url in product.photos:
            photo = ProductPhoto(product_id=db_product.id, photo_url=url)
            db.add(photo)
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
    product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")
    return product

@router.put("/{product_id}", response_model=ProductSchema)
def update_product(
    product_id: int,
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_product = db.query(ProductModel).filter(
        ProductModel.id == product_id,
        ProductModel.organization_id == current_user.organization_id
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Продукт не найден или недоступен")

    # Обновляем основные поля
    for key, value in product.dict(exclude={"vehicle_ids", "photos"}).items():
        setattr(db_product, key, value)

    # Обновляем фото: удаляем старые, добавляем новые
    if product.photos is not None:
        # Удаляем все предыдущие фото
        db.query(ProductPhoto).filter(ProductPhoto.product_id == product_id).delete()
        # Добавляем новые
        for url in product.photos:
            photo = ProductPhoto(product_id=product_id, photo_url=url)
            db.add(photo)

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

    # Удаляем файл с диска, если это локальный файл
    if photo.photo_url.startswith('/uploads/'):
        filename = photo.photo_url.replace('/uploads/', '')
        filepath = os.path.join('uploads', filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except OSError:
                # Логируем ошибку, но не прерываем выполнение
                pass

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

    # Удаляем файлы с диска и записи из базы
    for photo in photos:
        # Удаляем файл с диска, если это локальный файл
        if photo.photo_url.startswith('/uploads/'):
            filename = photo.photo_url.replace('/uploads/', '')
            filepath = os.path.join('uploads', filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except OSError:
                    # Логируем ошибку, но не прерываем выполнение
                    pass

        # Удаляем запись из базы данных
        db.delete(photo)

    db.commit()

    return

@router.get("/", response_model=list[ProductSchema])
def get_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Организация не указана")
    
    products = (
        db.query(ProductModel)
        .options(
            selectinload(ProductModel.photos),
            selectinload(ProductModel.compatible_vehicles),
            selectinload(ProductModel.creator)
        )
        .filter(ProductModel.organization_id == current_user.organization_id)
        .all()
    )
    return products
