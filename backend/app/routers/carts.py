from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.auth import get_current_user
from app.models.user import User
from app.models.organization import Organization
from app.models.carts import Cart, NewPartsCart, UsedPartsCart
from app.schemas.carts import (
    NewPartsCartItem,
    CartItemResponse,
    CartResponse,
    UpdateQuantityRequest
)
from datetime import datetime

router = APIRouter(prefix="/cart", tags=["Cart"])

# Get or create user cart
def get_or_create_cart(db: Session, user_id: int) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user_id).first()
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


@router.post("/new-parts", response_model=CartItemResponse)
def add_new_parts_to_cart(
    item: NewPartsCartItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add new parts to cart"""
    # Get or create cart
    cart = get_or_create_cart(db, current_user.id)

    # Check if item already exists in cart
    existing_item = db.query(NewPartsCart).filter(
        NewPartsCart.cart_id == cart.id,
        NewPartsCart.stock_id == item.stock_id,
        NewPartsCart.brand == item.brand,
        NewPartsCart.partnumber == item.partnumber
    ).first()

    if existing_item:
        # Update quantity
        existing_item.quantity += item.quantity
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

    # Create new cart item
    cart_item = NewPartsCart(
        cart_id=cart.id,
        user_id=current_user.id,
        brand=item.brand,
        partnumber=item.partnumber,
        name=item.name,
        delivery=item.delivery,
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


@router.get("/", response_model=CartResponse)
def get_cart(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get cart contents"""
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()

    if not cart:
        # Return empty cart
        return CartResponse(
            id=0,
            user_id=current_user.id,
            new_parts_items=[],
            used_parts_items=[]
        )

    # Find admin and organization
    admin = db.query(User).filter(User.is_admin == True).first()
    admin_org = "New parts"  # Default value

    if admin and admin.organization_id:
        # Get admin organization
        admin_organization = db.query(Organization).filter(Organization.id == admin.organization_id).first()
        if admin_organization:
            admin_org = admin_organization.name

    # Get new parts
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
            seller=admin_org,  # Always show admin organization or "New parts"
            created_at=item.created_at
        ))

    # Get used parts (empty for now)
    used_parts_items = []

    return CartResponse(
        id=cart.id,
        user_id=cart.user_id,
        new_parts_items=new_parts_items,
        used_parts_items=used_parts_items
    )


@router.delete("/new-parts/{item_id}", status_code=204)
def remove_from_cart(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove item from cart"""
    cart_item = db.query(NewPartsCart).filter(
        NewPartsCart.id == item_id,
        NewPartsCart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Item not found in cart"
        )

    db.delete(cart_item)
    db.commit()
    return


@router.put("/new-parts/{item_id}/quantity", response_model=CartItemResponse)
def update_cart_item_quantity(
    item_id: int,
    quantity_data: UpdateQuantityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update item quantity in cart"""
    if quantity_data.quantity <= 0:
        raise HTTPException(
            status_code=400,
            detail="Quantity must be greater than 0"
        )

    cart_item = db.query(NewPartsCart).filter(
        NewPartsCart.id == item_id,
        NewPartsCart.user_id == current_user.id
    ).first()

    if not cart_item:
        raise HTTPException(
            status_code=404,
            detail="Item not found in cart"
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



@router.post("/new-parts", response_model=CartItemResponse)
def add_new_parts_to_cart(
    item: NewPartsCartItem,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Добавить новые запчасти в корзину"""
    # Получить или создать корзину
    cart = get_or_create_cart(db, current_user.id)

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
        delivery=item.delivery,
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
    cart = db.query(Cart).filter(Cart.user_id == current_user.id).first()

    if not cart:
        # Вернуть пустую корзину
        return CartResponse(
            id=0,
            user_id=current_user.id,
            new_parts_items=[],
            used_parts_items=[]
        )

    # Найти админа и его организацию
    admin = db.query(User).filter(User.is_admin == True).first()
    admin_org = "Новые запчасти"  # Значение по умолчанию

    if admin and admin.organization_id:
        # Получить организацию админа
        admin_organization = db.query(Organization).filter(Organization.id == admin.organization_id).first()
        if admin_organization:
            admin_org = admin_organization.name

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
            seller=admin_org,  # Всегда показываем организацию админа или "Новые запчасти"
            created_at=item.created_at
        ))

    # Получить б/у запчасти (пока пустой список)
    used_parts_items = []

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
