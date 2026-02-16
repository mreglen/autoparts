from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.carts import Cart, NewPartsCart, UsedPartsCart
from app.models.client import Client as ClientModel
from app.schemas.carts import (
    NewPartsCartItem,
    UsedPartsCartItem,
    CartItemResponse,
    CartResponse,
    UpdateQuantityRequest
)
from app.models.product import Product
from app.utils.phone import normalize_to_storage_format
from datetime import datetime

router = APIRouter(prefix="/cart", tags=["Cart"])

# Получить или создать корзину пользователя
def get_or_create_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart

from fastapi import Request

@router.post("/new-parts", response_model=CartItemResponse)
async def add_new_parts_to_cart(
    item: NewPartsCartItem,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Добавить новые запчасти в корзину и создать клиента для текущей организации
    
    Добавить новые запчасти в корзину
    """
    # Debug: Print incoming item data
    print(f"DEBUG: Adding new parts to cart - Brand: '{item.brand}', Partnumber: '{item.partnumber}', GUID: '{item.guid}', Stock ID: '{item.stock_id}'")
    print(f"DEBUG: Price: {item.price}, Quantity: {item.quantity}")
    print(f"DEBUG: Current user ID: {current_user.id}")
    
    # Validate required fields
    if not item.brand or not item.brand.strip():
        print(f"DEBUG: Invalid brand: '{item.brand}'")
        raise HTTPException(status_code=422, detail="Brand is required and cannot be empty")
    
    if not item.partnumber or not item.partnumber.strip():
        print(f"DEBUG: Invalid partnumber: '{item.partnumber}'")
        raise HTTPException(status_code=422, detail="Part number is required and cannot be empty")
    
    if not item.stock_id or not item.stock_id.strip():
        print(f"DEBUG: Invalid stock_id: '{item.stock_id}'")
        raise HTTPException(status_code=422, detail="Stock ID is required and cannot be empty")
    
    if item.price is None or item.price <= 0:
        print(f"DEBUG: Invalid price: {item.price}")
        raise HTTPException(status_code=422, detail="Price is required and must be greater than 0")
    
    if item.quantity <= 0:
        print(f"DEBUG: Invalid quantity: {item.quantity}")
        raise HTTPException(status_code=422, detail="Quantity must be greater than 0")
    
    # Handle delivery field - convert to string if it's not already a string or None
    delivery_str = None
    if item.delivery is not None:
        if isinstance(item.delivery, dict):
            # If delivery is a dictionary (React element-like), extract the string representation
            print(f"DEBUG: Delivery field is a dict: {item.delivery}")
            # Handle dictionary objects coming from frontend
            delivery_str = str(item.delivery) if str(item.delivery) != '{}' else None
        elif hasattr(item.delivery, '__dict__'):
            # If delivery is an object with attributes
            print(f"DEBUG: Delivery field is an object: {item.delivery}")
            delivery_str = str(item.delivery)
        else:
            delivery_str = str(item.delivery) if item.delivery else None
    
    # Получить или создать корзину
    cart = get_or_create_cart(db, current_user.id)

    # Создать или получить клиента для организации админа
    # Это представляет интерес пользователя к продуктам от администратора
    client_phone = normalize_to_storage_format(current_user.phone) if current_user.phone else ""
    
    # Найти организацию админа (пользователя с is_admin = True)
    admin_user = db.query(User).filter(User.is_admin == True).first()
    admin_organization_id = admin_user.organization_id if admin_user else current_user.organization_id
    
    # Проверить, существует ли уже клиент для этой организации
    existing_client = db.query(ClientModel).filter(
        ClientModel.phone == client_phone,
        ClientModel.organization_id == admin_organization_id
    ).first()
    
    # Создать клиента если не существует
    if not existing_client and client_phone:
        new_client = ClientModel(
            last_name=current_user.last_name or "",
            first_name=current_user.first_name or "",
            patronymic=current_user.patronymic,
            email=current_user.email or "",
            phone=client_phone,
            organization_id=admin_organization_id  # Организация админа
        )
        db.add(new_client)
        db.flush()  # Чтобы получить ID клиента

    # Проверить, не добавлен ли уже этот товар в корзину
    existing_item = db.query(NewPartsCart).filter(
        NewPartsCart.cart_id == cart.id,
        NewPartsCart.stock_id == item.stock_id,
        NewPartsCart.brand == item.brand,
        NewPartsCart.partnumber == item.partnumber
    ).first()

    if existing_item:
        # Обновить количество
        existing_item.quantity += item.quantity
        # Also update delivery if provided
        if delivery_str is not None:
            existing_item.delivery = delivery_str
        existing_item.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_item)
        return CartItemResponse(
            id=existing_item.id,
            brand=existing_item.brand,
            partnumber=existing_item.partnumber,
            name=existing_item.name,
            delivery=existing_item.delivery,
            quantity=existing_item.quantity,
            price=existing_item.price,
            stock_id=existing_item.stock_id,
            seller=existing_item.seller,
            created_at=existing_item.created_at
        )

    # Создать новый элемент корзины
    cart_item = NewPartsCart(
        cart_id=cart.id,
        user_id=current_user.id,
        brand=item.brand,
        partnumber=item.partnumber,
        name=item.name,
        delivery=delivery_str,
        quantity=item.quantity,
        price=item.price,
        stock_id=item.stock_id,
        guid=item.guid,
        delivery_start=item.delivery_start,
        delivery_end=item.delivery_end
    )

    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)

    return CartItemResponse(
        id=cart_item.id,
        brand=cart_item.brand,
        partnumber=cart_item.partnumber,
        name=cart_item.name,
        delivery=cart_item.delivery,
        quantity=cart_item.quantity,
        price=cart_item.price,
        stock_id=cart_item.stock_id,
        seller=cart_item.seller,
        created_at=cart_item.created_at
    )

@router.post("/used-parts", response_model=CartItemResponse)
def add_used_parts_to_cart(
    item: UsedPartsCartItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Добавить б/у запчасти в корзину и создать клиента для организации-владельца"""
    """Добавить б/у запчасти в корзину"""
    cart = get_or_create_cart(db, current_user.id)

    # Найти продукт
    product = db.query(Product).filter(Product.id == item.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    # Создать или получить клиента для организации-владельца продукта
    # Используем данные текущего пользователя как клиента для организации-владельца
    client_phone = normalize_to_storage_format(current_user.phone) if current_user.phone else ""
    
    # Проверить, существует ли уже клиент для этой организации
    existing_client = db.query(ClientModel).filter(
        ClientModel.phone == client_phone,
        ClientModel.organization_id == product.organization_id
    ).first()
    
    # Создать клиента если не существует
    if not existing_client and client_phone:
        new_client = ClientModel(
            last_name=current_user.last_name or "",
            first_name=current_user.first_name or "",
            patronymic=current_user.patronymic,
            email=current_user.email or "",
            phone=client_phone,
            organization_id=product.organization_id  # Организация-владелец продукта
        )
        db.add(new_client)
        db.flush()  # Чтобы получить ID клиента

    # Проверить, не добавлен ли уже этот товар в корзину
    existing_item = db.query(UsedPartsCart).filter(
        UsedPartsCart.cart_id == cart.id,
        UsedPartsCart.product_id == item.product_id
    ).first()

    if existing_item:
        existing_item.quantity += item.quantity
        existing_item.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_item)
        return CartItemResponse(
            id=existing_item.id,
            brand=product.brand,
            partnumber=product.article,
            name=product.name,
            quantity=existing_item.quantity,
            price=float(product.price) if product.price else 0,
            product_id=product.id,
            seller=existing_item.seller,
            created_at=existing_item.created_at
        )

    # Создать новый элемент корзины
    cart_item = UsedPartsCart(
        cart_id=cart.id,
        user_id=current_user.id,
        product_id=product.id,
        quantity=item.quantity,
        brand=product.brand,
        partnumber=product.article,
        price=product.price
    )

    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)

    return CartItemResponse(
        id=cart_item.id,
        brand=product.brand,
        partnumber=product.article,
        name=product.name,
        quantity=cart_item.quantity,
        price=float(product.price) if product.price else 0,
        product_id=product.id,
        seller=cart_item.seller,
        created_at=cart_item.created_at
    )

@router.get("/admin-org-address")
def get_admin_org_address(db: Session = Depends(get_db)):
    """Получить адрес организации админа для самовывоза"""
    admin = db.query(User).filter(User.is_admin == True).first()
    if not admin or not admin.organization_id:
        raise HTTPException(status_code=404, detail="Администратор или его организация не найдены")

    admin_organization = db.query(Organization).filter(Organization.id == admin.organization_id).first()
    if not admin_organization or not admin_organization.address:
        raise HTTPException(status_code=404, detail="Адрес организации админа не найден")

    return {"address": admin_organization.address}

@router.get("/", response_model=CartResponse)
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить содержимое корзины пользователя"""
    cart = db.query(Cart).options(
        selectinload(Cart.new_parts_items),
        selectinload(Cart.used_parts_items).selectinload(UsedPartsCart.product).selectinload(Product.organization)
    ).filter(Cart.user_id == current_user.id).first()

    if not cart:
        # Вернуть пустую корзину
        return CartResponse(
            id=0,
            user_id=current_user.id,
            new_parts_items=[],
            used_parts_items=[]
        )

    # Получить новые запчасти
    new_parts_items = []
    for item in cart.new_parts_items:
        new_parts_items.append(CartItemResponse(
            id=item.id,
            brand=item.brand,
            partnumber=item.partnumber,
            name=item.name,
            delivery=item.delivery,
            quantity=item.quantity,
            price=item.price,
            stock_id=item.stock_id,
            seller=item.seller,  # Используем значение из модели (обычно "Новые запчасти")
            created_at=item.created_at
        ))

    # Получить б/у запчасти
    used_parts_items = []
    for item in cart.used_parts_items:
        # Пытаемся получить актуальные данные о продукте
        product = item.product
        used_parts_items.append(CartItemResponse(
            id=item.id,
            brand=product.brand if product else item.brand,
            partnumber=product.article if product else item.partnumber,
            name=product.name if product else "Б/У запчасть",
            quantity=item.quantity,
            price=float(product.price) if product and product.price else (float(item.price) if item.price else 0),
            product_id=item.product_id,
            seller=item.seller,  # Теперь возвращает название организации
            created_at=item.created_at
        ))

    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        new_parts_items=new_parts_items,
        used_parts_items=used_parts_items
    )

@router.delete("/new-parts/{item_id}", status_code=204)
def remove_new_parts_from_cart(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить новые запчасти из корзины"""
    cart_item = db.query(NewPartsCart).filter(
        NewPartsCart.id == item_id,
        NewPartsCart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден в корзине"
        )

    db.delete(cart_item)
    db.commit()
    return

@router.put("/new-parts/{item_id}/quantity", response_model=CartItemResponse)
def update_new_parts_quantity(
    item_id: int,
    quantity_data: UpdateQuantityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить количество новых запчастей в корзине"""
    if quantity_data.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Количество должно быть больше 0"
        )

    cart_item = db.query(NewPartsCart).filter(
        NewPartsCart.id == item_id,
        NewPartsCart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден в корзине"
        )

    cart_item.quantity = quantity_data.quantity
    cart_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cart_item)

    return CartItemResponse(
        id=cart_item.id,
        brand=cart_item.brand,
        partnumber=cart_item.partnumber,
        name=cart_item.name,
        delivery=cart_item.delivery,
        quantity=cart_item.quantity,
        price=cart_item.price,
        stock_id=cart_item.stock_id,
        seller=cart_item.seller,
        created_at=cart_item.created_at
    )

@router.delete("/used-parts/{item_id}", status_code=204)
def remove_used_parts_from_cart(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить б/у запчасти из корзины"""
    cart_item = db.query(UsedPartsCart).filter(
        UsedPartsCart.id == item_id,
        UsedPartsCart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")

    db.delete(cart_item)
    db.commit()
    return

@router.put("/used-parts/{item_id}/quantity", response_model=CartItemResponse)
def update_used_parts_quantity(
    item_id: int,
    quantity_data: UpdateQuantityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить количество б/у запчастей в корзине"""
    if quantity_data.quantity <= 0:
        raise HTTPException(status_code=400, detail="Количество должно быть больше 0")

    cart_item = db.query(UsedPartsCart).filter(
        UsedPartsCart.id == item_id,
        UsedPartsCart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(status_code=404, detail="Товар не найден в корзине")

    # Проверяем наличие продукта для получения актуальных данных
    product = db.query(Product).filter(Product.id == cart_item.product_id).first()

    cart_item.quantity = quantity_data.quantity
    cart_item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cart_item)

    return CartItemResponse(
        id=cart_item.id,
        brand=product.brand if product else cart_item.brand,
        partnumber=product.article if product else cart_item.partnumber,
        name=product.name if product else "Б/У запчасть",
        quantity=cart_item.quantity,
        price=float(product.price) if product and product.price else (float(cart_item.price) if cart_item.price else 0),
        product_id=cart_item.product_id,
        seller=cart_item.seller,
        created_at=cart_item.created_at
    )
